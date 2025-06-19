// import { ExecutionStatusEnum } from '../index.js';
// import { OperationResult } from '../types/interfaces/index.js';
// import { EventEmitter } from 'eventemitter3';

// /**
//  * Manages the state and status tracking for cross-chain operations.
//  */
// export class OperationMonitor {

//     private emitter = new EventEmitter()

//     // Use OperationResult directly as the tracking info structure
//     private trackedOperations: Map<string, OperationResult>;
//     private adapter: {
//         name: string,
//         version: string
//     }

//     constructor(adapter: {
//         name: string,
//         version: string
//     }) {
//         this.trackedOperations = new Map<string, OperationResult>();
//         console.log("[OperationMonitor] Initialized.");
//         this.adapter = adapter
//     }

//     /**
//      * Registers a new operation to be tracked with its initial status.
//      * @param operationId - The unique ID of the operation.
//      * @param initialStatus - The initial status object for the operation.
//      */
//     registerOperation(operationId: string, initialStatus: OperationResult): void {
//         if (this.trackedOperations.has(operationId)) {
//             console.warn(`[OperationMonitor] Operation ${operationId} is already being tracked. Overwriting initial status.`);
//         }
//         console.log(`[OperationMonitor] Registering operation: ${operationId}`, initialStatus);
//         // Store a copy to prevent external modifications
//         this.trackedOperations.set(operationId, { ...initialStatus });
//     }

//     /**
//      * Updates the status of a tracked operation. Merges the update with existing data.
//      * @param operationId - The ID of the operation to update.
//      * @param statusUpdate - An object containing the fields to update (Partial<OperationResult>).
//      */
//     updateOperationStatus(id: string, statusUpdate: Partial<OperationResult>) {
//         const current = this.trackedOperations.get(id);
//         let updated: OperationResult;

//         if (!current) {
//             updated = {
//                 operationId: id,
//                 status: ExecutionStatusEnum.UNKNOWN,
//                 sourceTx: {},
//                 destinationTx: {},
//                 adapter: this.adapter,
//                 ...statusUpdate,
//             };
//         } else {
//             updated = {
//                 ...current,
//                 ...statusUpdate,
//                 sourceTx: { ...current.sourceTx, ...(statusUpdate.sourceTx || {}) },
//                 destinationTx: { ...current.destinationTx, ...(statusUpdate.destinationTx || {}) },
//             };
//         }

//         this.trackedOperations.set(id, updated);

//         // ← emit *every* time we update
//         this.emitter.emit('statusUpdate', { ...updated });
//     }

//     onStatusUpdate(cb: (op: OperationResult) => void) {
//         this.emitter.on('statusUpdate', cb)
//     }

//     offStatusUpdate(cb: any) {
//         this.emitter.off('statusUpdate', cb)
//     }

//     /**
//      * Retrieves the current status of a tracked operation.
//      * @param operationId - The ID of the operation to query.
//      * @returns The current OperationResult, or undefined if not tracked.
//      */
//     getOperationStatus(operationId: string): OperationResult | undefined {
//         const status = this.trackedOperations.get(operationId);
//         console.log(`[OperationMonitor] Getting status for ${operationId}:`, status ? status.status : 'Not Found');
//         // Return a copy to prevent external modifications
//         return status ? { ...status } : undefined;
//     }

//     /**
//      * Removes an operation from tracking (e.g., for cleanup).
//      * @param operationId - The ID of the operation to remove.
//      */
//     removeOperation(operationId: string): boolean {
//         const deleted = this.trackedOperations.delete(operationId);
//         if (deleted) {
//             console.log(`[OperationMonitor] Removed operation from tracking: ${operationId}`);
//         } else {
//             console.warn(`[OperationMonitor] Attempted to remove untracked operation: ${operationId}`);
//         }
//         return deleted;
//     }

//     /**
//      * Clears all tracked operations (useful for testing or reset).
//      */
//     clearAllOperations(): void {
//         this.trackedOperations.clear();
//         console.log("[OperationMonitor] Cleared all tracked operations.");
//     }
// }



import { ExecutionStatusEnum } from '../index.js';
import { OperationResult, ICrossChain } from '../types/interfaces/index.js';
import { EventEmitter } from 'eventemitter3';

export class OperationMonitor {
    private emitter = new EventEmitter();
    private trackedOperations: Map<string, OperationResult> = new Map();

    constructor(private adapter: ICrossChain) {
        console.log('[OperationMonitor] Listening for adapter status events');
        this.adapter.on('status', op => this.updateOperationStatus(op.operationId, op));
    }

    registerOperation(operationId: string, initialStatus: OperationResult): void {
        this.trackedOperations.set(operationId, { ...initialStatus });
    }

    updateOperationStatus(id: string, statusUpdate: Partial<OperationResult>) {
        const current = this.trackedOperations.get(id) || {
            operationId: id,
            status: ExecutionStatusEnum.UNKNOWN,
            sourceTx: {},
            destinationTx: {},
            adapter: { name: '', version: '' },
        };
        const updated: OperationResult = {
            ...current,
            ...statusUpdate,
            sourceTx: { ...current.sourceTx, ...(statusUpdate.sourceTx || {}) },
            destinationTx: { ...current.destinationTx, ...(statusUpdate.destinationTx || {}) },
        };
        this.trackedOperations.set(id, updated);
        this.emitter.emit('statusUpdate', updated);
    }

    onStatusUpdate(cb: (op: OperationResult) => void) {
        this.emitter.on('statusUpdate', cb);
    }

    offStatusUpdate(cb: (op: OperationResult) => void) {
        this.emitter.off('statusUpdate', cb);
    }

    getOperationStatus(operationId: string): OperationResult | undefined {
        return this.trackedOperations.get(operationId);
    }

    removeOperation(operationId: string): boolean {
        return this.trackedOperations.delete(operationId);
    }

    clearAllOperations(): void {
        this.trackedOperations.clear();
    }
}