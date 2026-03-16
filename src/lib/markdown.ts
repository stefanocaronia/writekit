/**
 * Centralized markdown parser with extensions.
 * All markdown-to-HTML conversion should use this module.
 */

import { marked } from "marked";
import markedFootnote from "marked-footnote";

// Configure marked once with all extensions
marked.use(markedFootnote());

export { marked };
