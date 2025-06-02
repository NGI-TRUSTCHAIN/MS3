import { GenerateContractInput, CairoWizardKey, CairoContractOptions, WizardAPI, StellarContractOptions, StylusWizardKey, StylusContractOptions } from "@m3s/smart-contract";
import { ERC1155Options as ozERC1155Options } from "@openzeppelin/wizard/dist/erc1155.js";
import { ERC20Options as ozERC20Options } from "@openzeppelin/wizard/dist/erc20.js";
import { ERC721Options as ozERC721Options } from "@openzeppelin/wizard/dist/erc721.js";

export default class CodeGenerator {
    async generate(input: GenerateContractInput): Promise<string> {
        console.log(`[CodeGenerator] Generating contract for language: ${input.language}, template: ${input.template || 'default'}`);
        const { language, template, options } = input;

        try {
            switch (language.toLowerCase()) {
                case 'solidity':
                    const standard = template?.replace('openzeppelin_', '').toUpperCase();
                    // Use dynamic imports to avoid loading unused wizards
                    const wizard = await import('@openzeppelin/wizard');
                    switch (standard) {
                        case 'ERC20': return wizard.erc20.print(options as ozERC20Options);
                        case 'ERC721': return wizard.erc721.print(options as ozERC721Options);
                        case 'ERC1155': return wizard.erc1155.print(options as ozERC1155Options);
                        // Add other Solidity templates if OZ Wizard supports them
                        default: throw new Error(`Unsupported Solidity template via OZ Wizard: ${template}`);
                    }
                case 'cairo':
                    try {
                        const cairoModule = await import('@openzeppelin/wizard-cairo');
                        const { printContract: cairoPrint, ...cairoWizards } = cairoModule;

                        const cairoTemplate = template?.toLowerCase() as CairoWizardKey | undefined;
                        if (!cairoTemplate) throw new Error(`Cairo template not specified.`);

                        if (cairoTemplate === 'custom' && typeof cairoPrint === 'function') {
                            return cairoPrint(options as CairoContractOptions);
                        }

                        const wizardImpl = cairoWizards[cairoTemplate as keyof typeof cairoWizards];

                        if (wizardImpl && typeof wizardImpl === 'object' && 'print' in wizardImpl && typeof wizardImpl.print === 'function') {
                            return (wizardImpl as WizardAPI).print(options as CairoContractOptions);
                        }

                        throw new Error(`Unsupported or invalid Cairo template: ${template}`);
                    } catch (e: any) {

                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Cairo generation requires '@openzeppelin/wizard-cairo'. Please install it.");
                        throw e; // Re-throw other errors
                    }
                case 'stellar': // Soroban (Rust)
                    try {
                        const { fungible: stellarFungible } = await import('@openzeppelin/wizard-stellar');
                        if (template?.toLowerCase() === 'fungible') {
                            return stellarFungible.print(options as StellarContractOptions);
                        }
                        throw new Error(`Unsupported Stellar template: ${template}. Use 'fungible'.`);
                    } catch (e: any) {
                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Stellar generation requires '@openzeppelin/wizard-stellar'. Please install it.");
                        throw e;
                    }
                case 'stylus': // Arbitrum Stylus (Rust)
                    try {
                        const stylusModule = await import('@openzeppelin/wizard-stylus');
                        const { printContract: stylusPrint, ...stylusWizards } = stylusModule;
                        const stylusTemplate = template?.toLowerCase() as StylusWizardKey | undefined;
                        if (!stylusTemplate) throw new Error(`Stylus template not specified.`);
                        const wizardImpl = stylusWizards[stylusTemplate as keyof typeof stylusWizards];
                        if (wizardImpl && typeof wizardImpl === 'object' && 'print' in wizardImpl && typeof wizardImpl.print === 'function') {
                            return (wizardImpl as WizardAPI).print(options as StylusContractOptions);
                        }
                        throw new Error(`Unsupported or invalid Stylus template: ${template}. Use 'erc20', 'erc721', or 'erc1155'.`);
                    } catch (e: any) {
                        if (e.code === 'ERR_MODULE_NOT_FOUND') throw new Error("Stylus generation requires '@openzeppelin/wizard-stylus'. Please install it.");
                        throw e;
                    }
                default:
                    throw new Error(`Unsupported contract language for generation: ${language}`);
            }
        } catch (error: any) {
            console.error(`[CodeGenerator] Failed to generate contract: ${error.message}`, error.stack);
            // Avoid re-wrapping the error if it's already informative
            if (error instanceof Error && error.message.startsWith('Failed to generate contract')) throw error;
            if (error instanceof Error && error.message.includes('requires')) throw error; // Pass specific requirement errors up
            throw new Error(`Failed to generate contract: ${error.message}`);
        }
    }
}