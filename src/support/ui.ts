// ANSI color helpers — no dependencies
const esc = (code: string) => `\x1b[${code}m`;
const reset = esc("0");

export const c = {
    bold: (s: string) => `${esc("1")}${s}${reset}`,
    dim: (s: string) => `${esc("2")}${s}${reset}`,
    italic: (s: string) => `${esc("3")}${s}${reset}`,
    green: (s: string) => `${esc("32")}${s}${reset}`,
    yellow: (s: string) => `${esc("33")}${s}${reset}`,
    red: (s: string) => `${esc("31")}${s}${reset}`,
    cyan: (s: string) => `${esc("36")}${s}${reset}`,
    magenta: (s: string) => `${esc("35")}${s}${reset}`,
    gray: (s: string) => `${esc("90")}${s}${reset}`,
};

// Themed icons for a book-writing CLI
export const icon = {
    book: "📖",
    quill: "✒️",
    chapter: "📄",
    character: "🎭",
    contributor: "✍️",
    location: "🏛️",
    note: "📝",
    event: "⏳",
    check: "✅",
    error: "❌",
    warn: "⚠️",
    build: "🔨",
    watch: "👁️",
    clean: "🧹",
    done: "✨",
    folder: "📁",
    git: "🌿",
    report: "📊",
    words: "📝",
    time: "⏱️",
    translate: "🌐",
};
