import { defineConfig } from "allure";

export default defineConfig({
  name: "Quality Lab – mattiazanchin.com",
  output: "./allure-report",
  // Storico delle esecuzioni: permette ad Allure di mostrare trend e test instabili.
  // In CI il file viene scaricato dal report pubblicato e ripubblicato aggiornato.
  historyPath: "./history.jsonl",
  plugins: {
    awesome: {
      options: {
        reportLanguage: "it",
        // Raggruppa i test per area del sito invece che per namespace C#.
        groupBy: ["epic", "feature"],
      },
    },
  },
});
