// .pnpmfile.cjs
function readPackage(pkg, context) {
  // Allow specific packages to run their build scripts
  const trustedBuildScripts = [
    '@prisma/client',
    '@prisma/engines',
    'prisma',
    'sharp', // if you use sharp and it has build scripts
    '@tailwindcss/oxide', // if needed
    // Add others if necessary
  ];

  if (pkg.name && trustedBuildScripts.includes(pkg.name)) {
    if (pkg.scripts && (pkg.scripts.install || pkg.scripts.postinstall || pkg.scripts.preinstall)) {
      context.log(`Allowing build scripts for ${pkg.name}`);
      // This tells pnpm to allow scripts for this package.
      // The actual mechanism might be to ensure `pnpm.onlyBuiltDependencies` is NOT
      // preventing these, or by explicitly allowing them if pnpm has such a feature.
      // More directly, pnpm looks at `pnpm.onlyBuiltDependencies` in package.json
      // or `pnpm.neverBuiltDependencies`.
      //
      // The most straightforward way if `pnpm approve-builds` isn't an option
      // during Docker build is to ensure these packages are NOT listed in
      // `pnpm.neverBuiltDependencies` and ARE listed in `pnpm.onlyBuiltDependencies`
      // if you use that whitelist approach.
      //
      // However, the warning itself implies pnpm is ignoring them by default.
      // The `approve-builds` command locally would modify a setting or a lockfile aspect.
      // For Docker, the simplest is to ensure these are allowed.
      //
      // An alternative is to add this to your package.json:
      // "pnpm": { "onlyBuiltDependencies": ["@prisma/client", "@prisma/engines", "prisma", ...] }
      // Or modify the `pnpm install` command.
    }
  }
  return pkg;
}
module.exports = { hooks: { readPackage } };