# Netlify build directory

Base directory of the Netlify build (see `netlify.toml` at the root). It has no `package.json`
on purpose: Netlify then installs no dependencies on its own, with an npm older than the one the
project requires. The build command upgrades npm first, then installs and builds at the root.
