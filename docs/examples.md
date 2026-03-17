# Examples

## Publishing with GitHub

If your project is on GitHub, you can automate publishing.

### Publish your book as a website (GitHub Pages)

Add this file to your project as `.github/workflows/pages.yml`:

```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g writekit
      - run: wk build html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build/
      - id: deployment
        uses: actions/deploy-pages@v4
```

Every time you push to main, your book is published as a web page.

### Attach ePub to a release

Add this as `.github/workflows/release.yml`:

```yaml
name: Build Release
on:
  push:
    tags: ["v*"]
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g writekit
      - run: wk build epub
      - uses: softprops/action-gh-release@v2
        with:
          files: build/*.epub
```

Tag a version (`git tag v1.0 && git push --tags`) and GitHub will build the ePub and attach it to the release.
