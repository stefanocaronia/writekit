import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/project/parse";

describe("parseFrontmatter", () => {
    it("parses empty frontmatter with LF line endings", () => {
        const input = "---\n---\n\nBody text";
        const result = parseFrontmatter(input);

        expect(result.data).toEqual({});
        expect(result.body).toBe("Body text");
    });

    it("parses empty frontmatter with CRLF line endings", () => {
        const input = "---\r\n---\r\n\r\nBody text";
        const result = parseFrontmatter(input);

        expect(result.data).toEqual({});
        expect(result.body).toBe("Body text");
    });
});
