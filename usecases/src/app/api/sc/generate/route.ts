import { createContractHandler } from "@m3s/smart-contract";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { contractType } = await req.json();
  
  try {
    // Crear el handler del contrato con OpenZeppelin
    const contractHandler = await createContractHandler({
      name: "openZeppelin",
      version: "1.0.0",
      options: {
        preserveOutput: true
      },
    });

    // Configurar la entrada según el tipo de contrato
    let generationInput;

    if (contractType === "erc20") {
      generationInput = {
        language: "solidity",
        template: "openzeppelin_erc20",
        options: {
          name: "M3S",
          symbol: "M3S",
          premint: "1000",
          burnable: true
        },
      };
    } else {
      generationInput = {
        language: "solidity",
        template: "openzeppelin_erc721",
        options: {
          name: "M3S",
          symbol: "M3S",
        },
      };
    }

    // Generar el código fuente
    const sourceCode = await contractHandler.generateContract(generationInput);

    const compilationInput = {
      sourceCode,
      language: "solidity",
      contractName: "M3S",
    };

    // Compila el contrato
    const compiledOutput = await contractHandler.compile(compilationInput);
    console.log("compiledOutput", compiledOutput);

    const deployedOutput = await compiledOutput.getRegularDeploymentData();
    console.log('deployedOutput', deployedOutput);

    return NextResponse.json({ contractHandler, sourceCode, compiledOutput, deployedOutput });
  } catch (error) {
    console.error("Error generating contract:", error);
    return NextResponse.json(
      { error: "Contract generation failed" },
      { status: 500 }
    );
  }
}
