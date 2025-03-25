import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Setup __filename and __dirname for ES modules:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Build the adapterConfigs path and convert it to a file URL:
const adapterConfigPath = path.join(
  __dirname,
  "..",
  "integration/config/adapter-configs.js"
);
const adapterConfigModule = await import(pathToFileURL(adapterConfigPath).href);
const { adapterConfigs } = adapterConfigModule;

function generateIntegrationTests(adapterName) {
  console.log(`Generating integration tests for ${adapterName} adapter...`);

  const adapterFilePath = path.join(
    __dirname,
    "..",
    "..",
    "packages",
    "wallet",
    "src",
    "adapters",
    `${adapterName}Wallet.ts`
  );

  if (!fs.existsSync(adapterFilePath)) {
    console.error(`Adapter file not found: ${adapterFilePath}`);
    process.exit(1);
  }

  const adapterContent = fs.readFileSync(adapterFilePath, "utf8");
  const interfaceMatch = adapterContent.match(/implements\s+(\w+)/);
  const interfaceName = interfaceMatch ? interfaceMatch[1] : "ICoreWallet";

  console.log(`Detected interface: ${interfaceName}`);

  // Step 2: Map interface to template directory
  const interfaceMap = {
    ICoreWallet: "core-wallet",
    IEVMWallet: "evm-wallet",
    // Add more interfaces as they're created
  };

  const templateDir = interfaceMap[interfaceName] || "core-wallet";
  console.log(`Using template directory: templates/${templateDir}`);

  // Step 3: Read the interface templates
  const templatesPath = path.join(
    __dirname,
    "..",
    "integration/templates",
    templateDir
  );

  if (!fs.existsSync(templatesPath)) {
    console.error(`Template directory not found: ${templatesPath}`);
    process.exit(1);
  }

  const htmlTemplate = fs.readFileSync(
    path.join(templatesPath, "template.html"),
    "utf8"
  );

  const tsTemplate = fs.readFileSync(
    path.join(templatesPath, "template.ts"),
    "utf8"
  );

  const config = adapterConfigs[adapterName.toLowerCase()];

  if (!config || !config.initCode) {
    throw new Error(`No initCode found for adapter "${adapterName}" in adapterConfigs`);
  }

  const initCode = config.initCode;

  // Step 5: Generate the adapter-specific files with the shared templates
  const networkImportPath = "../config/networks.js";
  
  const finalTsContent = tsTemplate
    .replace("{{NETWORK_IMPORT_PATH}}", networkImportPath)
    .replace("/* ADAPTER_INIT_CODE */", initCode)
    .replace(/\{\{ADAPTER_NAME\}\}/g, adapterName)
    .replace(/\{\{INTERFACE_NAME\}\}/g, interfaceName);

  const finalHtmlContent = htmlTemplate.replace(
    /\{\{ADAPTER_NAME\}\}/g,
    adapterName
  );

  // Write the files into a flat fixtures directory (instead of adapter-specific subfolders)
  const outputDir = path.join(__dirname, "..", "integration", "fixtures");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(outputDir, `${adapterName.toLowerCase()}.html`),
    finalHtmlContent
  );

  fs.writeFileSync(
    path.join(outputDir, `${adapterName.toLowerCase()}-bundle.ts`),
    finalTsContent
  );

  updateWebpackConfig(adapterName);
  console.log(
    `Integration test files successfully generated for ${adapterName}:`
  );
  console.log(`- ${adapterName.toLowerCase()}.html`);
  console.log(`- ${adapterName.toLowerCase()}-bundle.ts`);
}


function updateWebpackConfig(adapterName) {
  const webpackConfigPath = path.join(__dirname, '..', 'webpack.conf.cjs');
  if (!fs.existsSync(webpackConfigPath)) {
    console.error(`Webpack config not found: ${webpackConfigPath}`);
    return;
  }
  
  let webpackConfig = fs.readFileSync(webpackConfigPath, 'utf8');
  const newEntryKey = `${adapterName.toLowerCase()}-bundle`;
  const newEntryLine = `'${newEntryKey}': "./integration/fixtures/${adapterName.toLowerCase()}-bundle.ts"`;

  // Match the entry block
  const entryBlockRegex = /entry:\s*{([^}]*)}/;
  const entryMatch = webpackConfig.match(entryBlockRegex);
  
  if (entryMatch) {
    // Split current entries into lines (if any)
    const currentEntries = entryMatch[1]
      .split(',')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // Filter any duplicate for our adapter key
    const filteredEntries = currentEntries.filter(
      entry => !entry.startsWith(`'${newEntryKey}'`)
    );
    
    // Add our new entry line
    filteredEntries.push(newEntryLine);
    
    // Create updated entry block with proper formatting
    const updatedEntries = filteredEntries.join(",\n    ");
    webpackConfig = webpackConfig.replace(entryBlockRegex, `entry: {\n    ${updatedEntries}\n  }`);
    console.log(`Updated webpack config with ${adapterName} bundle entry`);
  } else {
    console.error("No entry block found in webpack config");
  }
  
  fs.writeFileSync(webpackConfigPath, webpackConfig);
}

// If the file is run directly (for ESM, we check import.meta.url)
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const adapterName = process.argv[2];

  if (!adapterName) {
    console.error("Please provide an adapter name");
    process.exit(1);
  }
  
  await generateIntegrationTests(adapterName);
}

export default generateIntegrationTests;
