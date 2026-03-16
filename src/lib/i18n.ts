/**
 * i18n — editorial labels for rendered book output.
 *
 * File names and CLI messages stay in English; only the text that appears
 * inside the rendered book (HTML, EPUB, DOCX, PDF) is translated here.
 */

export interface Labels {
    tableOfContents: string;
    colophon: string;
    chapter: string;
    synopsis: string;
    notes: string;
    bibliography: string;
    acknowledgments: string;
    aboutTheAuthor: string;
    cover: string;
    edition: string;
    publisher: string;
    translator: string;
    editor: string;
    illustrator: string;
    copyright: string;
    allRightsReserved: string;
    license: string;
}

const en: Labels = {
    tableOfContents: "Table of Contents",
    colophon: "Colophon",
    chapter: "Chapter",
    synopsis: "Synopsis",
    notes: "Notes",
    bibliography: "Bibliography",
    acknowledgments: "Acknowledgments",
    aboutTheAuthor: "About the Author",
    cover: "Cover",
    edition: "Edition",
    publisher: "Publisher",
    translator: "Translated by",
    editor: "Edited by",
    illustrator: "Illustrations by",
    copyright: "Copyright",
    allRightsReserved: "All rights reserved",
    license: "License",
};

const it: Labels = {
    tableOfContents: "Indice",
    colophon: "Colophon",
    chapter: "Capitolo",
    synopsis: "Sinossi",
    notes: "Note",
    bibliography: "Bibliografia",
    acknowledgments: "Ringraziamenti",
    aboutTheAuthor: "L'autore",
    cover: "Copertina",
    edition: "Edizione",
    publisher: "Editore",
    translator: "Traduzione di",
    editor: "A cura di",
    illustrator: "Illustrazioni di",
    copyright: "Diritti d'autore",
    allRightsReserved: "Tutti i diritti riservati",
    license: "Licenza",
};

const fr: Labels = {
    tableOfContents: "Table des matières",
    colophon: "Colophon",
    chapter: "Chapitre",
    synopsis: "Synopsis",
    notes: "Notes",
    bibliography: "Bibliographie",
    acknowledgments: "Remerciements",
    aboutTheAuthor: "À propos de l'auteur",
    cover: "Couverture",
    edition: "Édition",
    publisher: "Éditeur",
    translator: "Traduit par",
    editor: "Sous la direction de",
    illustrator: "Illustrations de",
    copyright: "Droits d'auteur",
    allRightsReserved: "Tous droits réservés",
    license: "Licence",
};

const de: Labels = {
    tableOfContents: "Inhaltsverzeichnis",
    colophon: "Impressum",
    chapter: "Kapitel",
    synopsis: "Zusammenfassung",
    notes: "Anmerkungen",
    bibliography: "Literaturverzeichnis",
    acknowledgments: "Danksagung",
    aboutTheAuthor: "Über den Autor",
    cover: "Umschlag",
    edition: "Ausgabe",
    publisher: "Verlag",
    translator: "Übersetzt von",
    editor: "Herausgegeben von",
    illustrator: "Illustrationen von",
    copyright: "Urheberrecht",
    allRightsReserved: "Alle Rechte vorbehalten",
    license: "Lizenz",
};

const es: Labels = {
    tableOfContents: "Índice",
    colophon: "Colofón",
    chapter: "Capítulo",
    synopsis: "Sinopsis",
    notes: "Notas",
    bibliography: "Bibliografía",
    acknowledgments: "Agradecimientos",
    aboutTheAuthor: "Sobre el autor",
    cover: "Portada",
    edition: "Edición",
    publisher: "Editorial",
    translator: "Traducción de",
    editor: "Edición a cargo de",
    illustrator: "Ilustraciones de",
    copyright: "Derechos de autor",
    allRightsReserved: "Todos los derechos reservados",
    license: "Licencia",
};

const pt: Labels = {
    tableOfContents: "Índice",
    colophon: "Colofão",
    chapter: "Capítulo",
    synopsis: "Sinopse",
    notes: "Notas",
    bibliography: "Bibliografia",
    acknowledgments: "Agradecimentos",
    aboutTheAuthor: "Sobre o autor",
    cover: "Capa",
    edition: "Edição",
    publisher: "Editora",
    translator: "Tradução de",
    editor: "Organização de",
    illustrator: "Ilustrações de",
    copyright: "Direitos autorais",
    allRightsReserved: "Todos os direitos reservados",
    license: "Licença",
};

const ru: Labels = {
    tableOfContents: "Содержание",
    colophon: "Выходные данные",
    chapter: "Глава",
    synopsis: "Синопсис",
    notes: "Примечания",
    bibliography: "Библиография",
    acknowledgments: "Благодарности",
    aboutTheAuthor: "Об авторе",
    cover: "Обложка",
    edition: "Издание",
    publisher: "Издательство",
    translator: "Перевод:",
    editor: "Редактор:",
    illustrator: "Иллюстрации:",
    copyright: "Авторские права",
    allRightsReserved: "Все права защищены",
    license: "Лицензия",
};

const ar: Labels = {
    tableOfContents: "المحتويات",
    colophon: "بيانات النشر",
    chapter: "الفصل",
    synopsis: "ملخص",
    notes: "ملاحظات",
    bibliography: "المراجع",
    acknowledgments: "شكر وتقدير",
    aboutTheAuthor: "عن المؤلف",
    cover: "الغلاف",
    edition: "الطبعة",
    publisher: "الناشر",
    translator: "ترجمة",
    editor: "تحرير",
    illustrator: "رسوم",
    copyright: "حقوق النشر",
    allRightsReserved: "جميع الحقوق محفوظة",
    license: "الرخصة",
};

const hi: Labels = {
    tableOfContents: "विषय-सूची",
    colophon: "प्रकाशन विवरण",
    chapter: "अध्याय",
    synopsis: "सारांश",
    notes: "टिप्पणियाँ",
    bibliography: "ग्रंथसूची",
    acknowledgments: "आभार",
    aboutTheAuthor: "लेखक के बारे में",
    cover: "आवरण",
    edition: "संस्करण",
    publisher: "प्रकाशक",
    translator: "अनुवादक:",
    editor: "संपादक:",
    illustrator: "चित्रकार:",
    copyright: "कॉपीराइट",
    allRightsReserved: "सर्वाधिकार सुरक्षित",
    license: "लाइसेंस",
};

const zh: Labels = {
    tableOfContents: "目录",
    colophon: "版权页",
    chapter: "第",
    synopsis: "简介",
    notes: "注释",
    bibliography: "参考文献",
    acknowledgments: "致谢",
    aboutTheAuthor: "关于作者",
    cover: "封面",
    edition: "版次",
    publisher: "出版社",
    translator: "译者：",
    editor: "编辑：",
    illustrator: "插图：",
    copyright: "版权",
    allRightsReserved: "版权所有",
    license: "许可协议",
};

const ko: Labels = {
    tableOfContents: "목차",
    colophon: "판권",
    chapter: "장",
    synopsis: "줄거리",
    notes: "주석",
    bibliography: "참고문헌",
    acknowledgments: "감사의 글",
    aboutTheAuthor: "저자 소개",
    cover: "표지",
    edition: "판",
    publisher: "출판사",
    translator: "번역:",
    editor: "편집:",
    illustrator: "삽화:",
    copyright: "저작권",
    allRightsReserved: "모든 권리 보유",
    license: "라이선스",
};

const ja: Labels = {
    tableOfContents: "目次",
    colophon: "奥付",
    chapter: "章",
    synopsis: "あらすじ",
    notes: "注釈",
    bibliography: "参考文献",
    acknowledgments: "謝辞",
    aboutTheAuthor: "著者について",
    cover: "表紙",
    edition: "版",
    publisher: "出版社",
    translator: "翻訳：",
    editor: "編集：",
    illustrator: "挿絵：",
    copyright: "著作権",
    allRightsReserved: "無断転載を禁じます",
    license: "ライセンス",
};

const nl: Labels = {
    tableOfContents: "Inhoudsopgave",
    colophon: "Colofon",
    chapter: "Hoofdstuk",
    synopsis: "Synopsis",
    notes: "Noten",
    bibliography: "Bibliografie",
    acknowledgments: "Dankwoord",
    aboutTheAuthor: "Over de auteur",
    cover: "Omslag",
    edition: "Editie",
    publisher: "Uitgeverij",
    translator: "Vertaald door",
    editor: "Redactie:",
    illustrator: "Illustraties van",
    copyright: "Auteursrecht",
    allRightsReserved: "Alle rechten voorbehouden",
    license: "Licentie",
};

const pl: Labels = {
    tableOfContents: "Spis treści",
    colophon: "Stopka redakcyjna",
    chapter: "Rozdział",
    synopsis: "Streszczenie",
    notes: "Przypisy",
    bibliography: "Bibliografia",
    acknowledgments: "Podziękowania",
    aboutTheAuthor: "O autorze",
    cover: "Okładka",
    edition: "Wydanie",
    publisher: "Wydawnictwo",
    translator: "Tłumaczenie:",
    editor: "Redakcja:",
    illustrator: "Ilustracje:",
    copyright: "Prawa autorskie",
    allRightsReserved: "Wszelkie prawa zastrzeżone",
    license: "Licencja",
};

const tr: Labels = {
    tableOfContents: "İçindekiler",
    colophon: "Künye",
    chapter: "Bölüm",
    synopsis: "Özet",
    notes: "Notlar",
    bibliography: "Kaynakça",
    acknowledgments: "Teşekkür",
    aboutTheAuthor: "Yazar Hakkında",
    cover: "Kapak",
    edition: "Baskı",
    publisher: "Yayınevi",
    translator: "Çeviren:",
    editor: "Editör:",
    illustrator: "Resimleyen:",
    copyright: "Telif Hakkı",
    allRightsReserved: "Tüm hakları saklıdır",
    license: "Lisans",
};

const sv: Labels = {
    tableOfContents: "Innehållsförteckning",
    colophon: "Kolofon",
    chapter: "Kapitel",
    synopsis: "Synopsis",
    notes: "Noter",
    bibliography: "Bibliografi",
    acknowledgments: "Tack",
    aboutTheAuthor: "Om författaren",
    cover: "Omslag",
    edition: "Utgåva",
    publisher: "Förlag",
    translator: "Översatt av",
    editor: "Redigerad av",
    illustrator: "Illustrationer av",
    copyright: "Upphovsrätt",
    allRightsReserved: "Alla rättigheter förbehållna",
    license: "Licens",
};

const el: Labels = {
    tableOfContents: "Πίνακας περιεχομένων",
    colophon: "Σελίδα τίτλου",
    chapter: "Κεφάλαιο",
    synopsis: "Σύνοψη",
    notes: "Σημειώσεις",
    bibliography: "Βιβλιογραφία",
    acknowledgments: "Ευχαριστίες",
    aboutTheAuthor: "Σχετικά με τον συγγραφέα",
    cover: "Εξώφυλλο",
    edition: "Έκδοση",
    publisher: "Εκδότης",
    translator: "Μετάφραση:",
    editor: "Επιμέλεια:",
    illustrator: "Εικονογράφηση:",
    copyright: "Πνευματικά δικαιώματα",
    allRightsReserved: "Με επιφύλαξη παντός δικαιώματος",
    license: "Άδεια",
};

const catalog: Record<string, Labels> = {
    en,
    it,
    fr,
    de,
    es,
    pt,
    ru,
    ar,
    hi,
    zh,
    ko,
    ja,
    nl,
    pl,
    tr,
    sv,
    el,
};

/**
 * Return editorial labels for the given language code.
 * Falls back to English if the language is not supported.
 */
export const supportedLanguages = Object.keys(catalog);

const nativeNames: Record<string, string> = {
    en: "English",
    it: "Italiano",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    pt: "Português",
    ru: "Русский",
    ar: "العربية",
    hi: "हिन्दी",
    zh: "中文",
    ko: "한국어",
    ja: "日本語",
    nl: "Nederlands",
    pl: "Polski",
    tr: "Türkçe",
    sv: "Svenska",
    el: "Ελληνικά",
};

export const languageChoices = supportedLanguages.map((code) => ({
    value: code,
    name: nativeNames[code] ?? code,
}));

export function getLabels(language: string): Labels {
    return catalog[language] ?? catalog["en"];
}
