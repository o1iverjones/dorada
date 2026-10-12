import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@dorada/i18n/locales/en.json";
import es from "@dorada/i18n/locales/es.json";

const savedLang = localStorage.getItem("dorada-pwa-lang");
const browserLang = navigator.language.split("-")[0];

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: savedLang || (browserLang === "es" ? "es" : "en"),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
