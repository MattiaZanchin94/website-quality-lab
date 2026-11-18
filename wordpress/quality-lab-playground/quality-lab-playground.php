<?php
/**
 * Plugin Name: Quality Lab Playground
 * Description: Mostra i risultati dei test E2E del sito e permette ai visitatori di avviarli. Shortcode: [quality_lab_playground]
 * Version:     1.7.1
 * Author:      Mattia Zanchin
 * License:     MIT
 *
 * Configurazione in wp-config.php (il token NON va mai nel codice o nel database):
 *   define( 'QLP_GITHUB_TOKEN', 'github_pat_...' );   // fine-grained, solo "Actions: Read and write" su questo repo
 *   define( 'QLP_PROGRESS_KEY', '...' );              // chiave per l'avanzamento in diretta, uguale al secret QLP_PROGRESS_KEY su GitHub
 */

defined( 'ABSPATH' ) || exit;

const QLP_VERSION     = '1.7.1';
const QLP_REPO        = 'Zancus/website-quality-lab';
const QLP_WORKFLOW    = 'e2e-tests.yml';
const QLP_PAGES_URL   = 'https://zancus.github.io/website-quality-lab';
const QLP_COOLDOWN    = 10 * MINUTE_IN_SECONDS; // al massimo un avvio ogni 10 minuti, per tutto il sito
const QLP_STATUS_TTL  = 10;                      // secondi di cache dello stato, per non interrogare GitHub a ogni visita
const QLP_BROWSERS    = array( 'all', 'chromium', 'msedge', 'firefox', 'webkit', 'iphone', 'android', 'fold', 'ipad', 'ipadland' ); // valori ammessi per l'avvio
const QLP_TEST_BROWSERS = array( 'chromium', 'msedge', 'firefox', 'webkit', 'iphone', 'android', 'fold', 'ipad', 'ipadland' );
const QLP_PROGRESS_TTL  = 2 * HOUR_IN_SECONDS; // l'avanzamento di un'esecuzione resta disponibile per 2 ore

/* -------------------------------------------------------------------------
 * GitHub API
 * ---------------------------------------------------------------------- */

function qlp_github_request( string $method, string $path, ?array $body = null ) {
	if ( ! defined( 'QLP_GITHUB_TOKEN' ) || ! QLP_GITHUB_TOKEN ) {
		return new WP_Error( 'qlp_not_configured', 'Token GitHub non configurato.' );
	}

	$args = array(
		'method'  => $method,
		'timeout' => 10,
		'headers' => array(
			'Authorization'        => 'Bearer ' . QLP_GITHUB_TOKEN,
			'Accept'               => 'application/vnd.github+json',
			'X-GitHub-Api-Version' => '2022-11-28',
			'User-Agent'           => 'quality-lab-playground',
		),
	);
	if ( null !== $body ) {
		$args['headers']['Content-Type'] = 'application/json';
		$args['body']                    = wp_json_encode( $body );
	}

	return wp_remote_request( 'https://api.github.com/repos/' . QLP_REPO . $path, $args );
}

/** Ultima esecuzione del workflow (più quante sono ancora attive), ridotta ai campi che servono alla pagina. */
function qlp_latest_run(): ?array {
	$cached = get_transient( 'qlp_latest_run' );
	if ( false !== $cached ) {
		return $cached ?: null;
	}

	$response = qlp_github_request( 'GET', '/actions/workflows/' . QLP_WORKFLOW . '/runs?per_page=5' );
	if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return null;
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	$runs = $data['workflow_runs'] ?? array();
	$run  = $runs[0] ?? null;
	// Esecuzioni non ancora finite (in corso o in coda): se sono più di una, l'ultima aspetta in coda.
	$active = count( array_filter( $runs, function ( $r ) { return 'completed' !== $r['status']; } ) );
	$out  = $run ? array(
		'id'         => $run['id'],
		'status'     => $run['status'],      // queued | in_progress | completed
		'conclusion' => $run['conclusion'],  // success | failure | null
		'title'      => $run['display_title'],
		'createdAt'  => $run['created_at'],
		'updatedAt'  => $run['updated_at'],
		'url'        => $run['html_url'],
		'activeRuns' => $active,
	) : array();

	set_transient( 'qlp_latest_run', $out, QLP_STATUS_TTL );
	return $out ?: null;
}

/* -------------------------------------------------------------------------
 * Avanzamento in diretta: i test (su GitHub Actions) comunicano "iniziato / superato / fallito"
 * ---------------------------------------------------------------------- */

/** Chiave del dato temporaneo: una per esecuzione e browser, così i browser in parallelo non si sovrascrivono. */
function qlp_progress_transient( string $run_id, string $browser ): string {
	return 'qlp_progress_' . $run_id . '_' . $browser;
}

/** Solo i test con la chiave giusta possono scrivere l'avanzamento. */
function qlp_progress_permission( WP_REST_Request $request ): bool {
	if ( ! defined( 'QLP_PROGRESS_KEY' ) || ! QLP_PROGRESS_KEY ) {
		return false;
	}
	return hash_equals( (string) QLP_PROGRESS_KEY, (string) $request->get_header( 'X-QLP-Key' ) );
}

function qlp_handle_progress( WP_REST_Request $request ) {
	$run_id  = (string) $request->get_param( 'runId' );
	$browser = (string) $request->get_param( 'browser' );
	$key     = sanitize_text_field( (string) $request->get_param( 'key' ) );
	$status  = (string) $request->get_param( 'status' );

	// Accettiamo solo valori attesi: niente testo libero oltre alla chiave del test (breve e ripulita).
	if ( ! preg_match( '/^\d{1,20}$/', $run_id )
		|| ! in_array( $browser, QLP_TEST_BROWSERS, true )
		|| ! in_array( $status, array( 'running', 'passed', 'failed', 'skipped' ), true )
		|| '' === $key || strlen( $key ) > 300 ) {
		return qlp_no_cache( new WP_REST_Response( array( 'ok' => false ), 400 ) );
	}

	$name     = qlp_progress_transient( $run_id, $browser );
	$progress = get_transient( $name );
	if ( ! is_array( $progress ) ) {
		$progress = array( 'tests' => array(), 'current' => null );
	}
	if ( count( $progress['tests'] ) >= 100 && ! isset( $progress['tests'][ $key ] ) ) {
		return qlp_no_cache( new WP_REST_Response( array( 'ok' => false ), 400 ) ); // limite di sicurezza
	}

	$progress['tests'][ $key ] = $status;
	$progress['current']       = 'running' === $status ? $key : null;
	$progress['updatedAt']     = gmdate( 'c' );
	set_transient( $name, $progress, QLP_PROGRESS_TTL );

	return qlp_no_cache( new WP_REST_Response( array( 'ok' => true ) ) );
}

/** Avanzamento di un'esecuzione, per browser: { chromium: { tests: {chiave: stato}, current }, ... } */
function qlp_progress_for_run( $run_id ): array {
	$out = array();
	foreach ( QLP_TEST_BROWSERS as $browser ) {
		$progress = get_transient( qlp_progress_transient( (string) $run_id, $browser ) );
		if ( is_array( $progress ) ) {
			$out[ $browser ] = $progress;
		}
	}
	return $out;
}

function qlp_cooldown_remaining(): int {
	$last = (int) get_transient( 'qlp_last_dispatch' );
	return $last ? max( 0, QLP_COOLDOWN - ( time() - $last ) ) : 0;
}

/* -------------------------------------------------------------------------
 * REST API: /wp-json/quality-lab/v1/status e /run
 * ---------------------------------------------------------------------- */

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'quality-lab/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => function () {
					$run = qlp_latest_run();
					return qlp_no_cache(
						new WP_REST_Response(
							array(
								'configured'        => defined( 'QLP_GITHUB_TOKEN' ) && QLP_GITHUB_TOKEN,
								'run'               => $run,
								// Test per test, solo per l'esecuzione più recente (vuoto se i test non lo inviano).
								'progress'          => $run ? qlp_progress_for_run( $run['id'] ) : new stdClass(),
								'cooldownRemaining' => qlp_cooldown_remaining(),
							)
						)
					);
				},
			)
		);

		register_rest_route(
			'quality-lab/v1',
			'/run',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true', // pubblico per scelta: il limite è il cooldown globale
				'callback'            => 'qlp_handle_run',
			)
		);

		register_rest_route(
			'quality-lab/v1',
			'/progress',
			array(
				'methods'             => 'POST',
				'permission_callback' => 'qlp_progress_permission', // solo con la chiave segreta
				'callback'            => 'qlp_handle_progress',
			)
		);
	}
);

function qlp_handle_run( WP_REST_Request $request ) {
	// Il visitatore può scegliere un solo browser: accettiamo solo valori noti, mai testo libero.
	$browser = (string) $request->get_param( 'browser' );
	if ( ! in_array( $browser, QLP_BROWSERS, true ) ) {
		$browser = 'all';
	}

	$remaining = qlp_cooldown_remaining();
	if ( $remaining > 0 ) {
		return qlp_no_cache(
			new WP_REST_Response(
				array(
					'started'           => false,
					'reason'            => 'cooldown',
					'cooldownRemaining' => $remaining,
				),
				429
			)
		);
	}

	// Se un'esecuzione è già in corso non ne accodiamo un'altra: la pagina seguirà quella.
	$run = qlp_latest_run();
	if ( $run && 'completed' !== $run['status'] ) {
		return qlp_no_cache(
			new WP_REST_Response(
				array(
					'started' => false,
					'reason'  => 'running',
					'run'     => $run,
				),
				409
			)
		);
	}

	// Blocchiamo subito il cooldown, prima della chiamata, per evitare doppi avvii simultanei.
	set_transient( 'qlp_last_dispatch', time(), QLP_COOLDOWN );

	$response = qlp_github_request(
		'POST',
		'/actions/workflows/' . QLP_WORKFLOW . '/dispatches',
		array(
			'ref'    => 'main',
			'inputs' => array(
				'source'  => 'website',
				'browser' => $browser,
			),
		)
	);

	if ( is_wp_error( $response ) || 204 !== wp_remote_retrieve_response_code( $response ) ) {
		delete_transient( 'qlp_last_dispatch' );
		// Il dettaglio va solo nel log del server: al visitatore non mostriamo nulla del token o di GitHub.
		error_log( 'Quality Lab Playground: dispatch fallito - ' . ( is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ) ) );
		return qlp_no_cache( new WP_REST_Response( array( 'started' => false, 'reason' => 'error' ), 502 ) );
	}

	delete_transient( 'qlp_latest_run' ); // il prossimo /status deve vedere la nuova esecuzione
	return qlp_no_cache(
		new WP_REST_Response(
			array(
				'started'           => true,
				'startedAt'         => gmdate( 'c' ),
				'cooldownRemaining' => QLP_COOLDOWN,
			),
			202
		)
	);
}

/** Le risposte non devono finire nella cache del server (SiteGround) o del browser. */
function qlp_no_cache( WP_REST_Response $response ): WP_REST_Response {
	$response->header( 'Cache-Control', 'no-store, max-age=0' );
	return $response;
}

/* -------------------------------------------------------------------------
 * Shortcode [quality_lab_playground]
 * ---------------------------------------------------------------------- */

add_shortcode(
	'quality_lab_playground',
	function () {
		$base = plugin_dir_url( __FILE__ );
		wp_enqueue_style( 'qlp', $base . 'assets/playground.css', array(), QLP_VERSION );
		wp_enqueue_script( 'qlp', $base . 'assets/playground.js', array(), QLP_VERSION, true );
		wp_localize_script(
			'qlp',
			'QLP_CONFIG',
			array(
				'statusUrl'  => rest_url( 'quality-lab/v1/status' ),
				'runUrl'     => rest_url( 'quality-lab/v1/run' ),
				'summaryUrl' => QLP_PAGES_URL . '/summary.json',
				'repoUrl'    => 'https://github.com/' . QLP_REPO,
			)
		);

		// Il contenuto viene disegnato da playground.js, che sceglie la lingua da <html lang>.
		// data-no-translation: TranslatePress non deve tradurre il riquadro, che ha già le sue traduzioni.
		$loading = 0 === strpos( determine_locale(), 'en' ) ? 'Loading results…' : 'Caricamento dei risultati…';
		return '<div id="qlp-root" class="qlp" aria-live="polite" data-no-translation><p class="qlp-loading">' . esc_html( $loading ) . '</p></div>';
	}
);
