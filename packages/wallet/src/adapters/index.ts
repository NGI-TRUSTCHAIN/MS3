// adapters/index.ts

// Export the registry
export * from './registry';  

// Export all adapters
export * from './mockedWallet';
export * from './etheresWallet';

// Load all registrations
import './mockedWallet.registration';
import './ethersWallet.registration';

// TODO: Estos adapters deberían venir del github.
// Paso 1: Alguien sube el pull request a la rama adecuada (collaborate/adapter/<adapter-name>)
// Paso 2: Ese pull request pasa un pipeline de CI/CD (Tests + Linting)
// Los tests deberían ser unitarios, donde se compruebe que el adapter implementa la interfaz adecuada.
// Y tambien debería haber tests de integración, donde se compruebe que el adapter funciona correctamente en el entrono adecuado, estos se haran fuera del pipeline de CI/CD.
// Paso 3: Si se pasan los test unitarios automaticos, el adapter debe entrar en nuestro repositorio privado de Bitbucket, donde tenemos este codigo actual.
// Deben venir tambien a una rama concreata, que se genera nueva con el pipeline en nuestro codigo de forma segura con el mismo nombre que en github.
// Nosotros entonces podremos ejecutar los tests de integración y si todo va bien, se podrá mergear a la rama de develop.