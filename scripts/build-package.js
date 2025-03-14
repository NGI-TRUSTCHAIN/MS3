const { buildPackage } = require("./buildHelper");

const packageName = process.argv[2];
if (!packageName) {
  console.error("Please specify a package name");
  process.exit(1);
}

buildPackage(packageName);