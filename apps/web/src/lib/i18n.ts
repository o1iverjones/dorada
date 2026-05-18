import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@dorada/i18n/locales/en.json";
import es from "@dorada/i18n/locales/es.json";

i18next.use(initReactI18next).init({
  lng: localStorage.getItem("dorada_locale") ?? "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  interpolation: { escapeValue: false },
});

i18next.on("languageChanged", (lng) => {
  localStorage.setItem("dorada_locale", lng);
  document.documentElement.lang = lng;
  document.documentElement.dir = ["ar", "he", "fa", "ur"].includes(lng) ? "rtl" : "ltr";
});

export default i18next;
