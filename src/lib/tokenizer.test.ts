import { describe, it, expect } from "vitest";
import { tokenizeBash } from "./tokenizer";

describe("tokenizeBash", () => {
  it("tokenizes a simple command", () => {
    const tokens = tokenizeBash("ls");
    expect(tokens).toEqual([{ type: "command", value: "ls" }]);
  });

  it("tokenizes command with flags", () => {
    const tokens = tokenizeBash("ls -la");
    expect(tokens).toEqual([
      { type: "command", value: "ls" },
      { type: "default", value: " " },
      { type: "flag", value: "-la" },
    ]);
  });

  it("tokenizes strings in quotes", () => {
    const tokens = tokenizeBash('echo "hello world"');
    expect(tokens).toEqual([
      { type: "command", value: "echo" },
      { type: "default", value: " " },
      { type: "default", value: '"hello' },
      { type: "default", value: " " },
      { type: "default", value: 'world"' },
    ]);
  });

  it("tokenizes numbers", () => {
    const tokens = tokenizeBash("echo 42");
    expect(tokens).toEqual([
      { type: "command", value: "echo" },
      { type: "default", value: " " },
      { type: "number", value: "42" },
    ]);
  });

  it("tokenizes variables", () => {
    const tokens = tokenizeBash("echo $HOME");
    expect(tokens).toEqual([
      { type: "command", value: "echo" },
      { type: "default", value: " " },
      { type: "variable", value: "$HOME" },
    ]);
  });

  it("tokenizes comments", () => {
    const tokens = tokenizeBash("#comment");
    expect(tokens).toEqual([{ type: "comment", value: "#comment" }]);
  });

  it("tokenizes paths", () => {
    const tokens = tokenizeBash("cd ./src");
    expect(tokens).toEqual([
      { type: "command", value: "cd" },
      { type: "default", value: " " },
      { type: "path", value: "./src" },
    ]);
  });

  it("tokenizes operators", () => {
    const tokens = tokenizeBash("ls | grep foo");
    expect(tokens).toEqual([
      { type: "command", value: "ls" },
      { type: "default", value: " " },
      { type: "operator", value: "|" },
      { type: "default", value: " " },
      { type: "command", value: "grep" },
      { type: "default", value: " " },
      { type: "default", value: "foo" },
    ]);
  });

  it("tokenizes cyrillic commands", () => {
    const tokens = tokenizeBash("whoami");
    expect(tokens[0]).toEqual({ type: "command", value: "whoami" });
  });

  it("handles empty string", () => {
    const tokens = tokenizeBash("");
    expect(tokens).toEqual([{ type: "command", value: "" }]);
  });
});
