import { OperationResult } from '../types/interfaces/index.js';

/**
 * Manages the state and status tracking for cross-chain operations.
 */
export class OperationMonitor {
    // Use OperationResult directly as the tracking info structure
    private trackedOperations: Map<string, OperationResult>;

    constructor() {
        this.trackedOperations = new Map<string, OperationResult>();
        console.log("[OperationMonitor] Initialized.");
    }

    /**
     * Registers a new operation to be tracked with its initial status.
     * @param operationId - The unique ID of the operation.
     * @param initialStatus - The initial status object for the operation.
     */
    registerOperation(operationId: string, initialStatus: OperationResult): void {
        if (this.trackedOperations.has(operationId)) {
            console.warn(`[OperationMonitor] Operation ${operationId} is already being tracked. Overwriting initial status.`);
        }
        console.log(`[OperationMonitor] Registering operation: ${operationId}`, initialStatus);
        // Store a copy to prevent external modifications
        this.trackedOperations.set(operationId, { ...initialStatus });
    }

    /**
     * Updates the status of a tracked operation. Merges the update with existing data.
     * @param operationId - The ID of the operation to update.
     * @param statusUpdate - An object containing the fields to update (Partial<OperationResult>).
     */
    updateOperationStatus(operationId: string, statusUpdate: Partial<OperationResult>): void {
        const currentStatus = this.trackedOperations.get(operationId);
        if (!currentStatus) {
            console.warn(`[OperationMonitor] Attempted to update status for untracked operation: ${operationId}. Registering it now.`);
            // If an update comes for an unknown ID, register it based on the update
            // This might happen if the initial executeOperation response is missed/delayed
            const newStatus: OperationResult = {
                operationId: operationId,
                status: 'UNKNOWN', // Default status if not provided in update
                sourceTx: {},
                adapterName: 'unknown', // Default adapter name
                ...statusUpdate, // Apply the partial update
            };
            this.trackedOperations.set(operationId, newStatus);
            console.log(`[OperationMonitor] Registered ${operationId} based on status update.`);
            return;
        }

        // Merge the update into the current status, handling nested objects
        const updatedStatus: OperationResult = {
            ...currentStatus,
            ...statusUpdate,
            // Deep merge for nested transaction info if provided in the update
            sourceTx: { ...currentStatus.sourceTx, ...(statusUpdate.sourceTx || {}) },
            destinationTx: { ...currentStatus.destinationTx, ...(statusUpdate.destinationTx || {}) },
        };

        // Log the change clearly
        if (currentStatus.status !== updatedStatus.status || currentStatus.statusMessage !== updatedStatus.statusMessage) {
             console.log(`[OperationMonitor] Updating status for ${operationId}: ${currentStatus.status} -> ${updatedStatus.status}`, { statusMessage: updatedStatus.statusMessage, update: statusUpdate });
        } else {
             console.log(`[OperationMonitor] Minor update for ${operationId} (status unchanged):`, { update: statusUpdate });
        }

        this.trackedOperations.set(operationId, updatedStatus);

        // Optional: Consider adding logic to automatically remove completed/failed operations
        // if (updatedStatus.status === 'COMPLETED' || updatedStatus.status === 'FAILED') {
        //     this.scheduleRemoval(operationId);
        // }
    }

    /**
     * Retrieves the current status of a tracked operation.
     * @param operationId - The ID of the operation to query.
     * @returns The current OperationResult, or undefined if not tracked.
     */
    getOperationStatus(operationId: string): OperationResult | undefined {
        const status = this.trackedOperations.get(operationId);
        console.log(`[OperationMonitor] Getting status for ${operationId}:`, status ? status.status : 'Not Found');
        // Return a copy to prevent external modifications
        return status ? { ...status } : undefined;
    }

    /**
     * Removes an operation from tracking (e.g., for cleanup).
     * @param operationId - The ID of the operation to remove.
     */
    removeOperation(operationId: string): boolean {
        const deleted = this.trackedOperations.delete(operationId);
        if (deleted) {
            console.log(`[OperationMonitor] Removed operation from tracking: ${operationId}`);
        } else {
            console.warn(`[OperationMonitor] Attempted to remove untracked operation: ${operationId}`);
        }
        return deleted;
    }

    /**
     * Clears all tracked operations (useful for testing or reset).
     */
    clearAllOperations(): void {
        this.trackedOperations.clear();
        console.log("[OperationMonitor] Cleared all tracked operations.");
    }

    // --- Optional: Helper for delayed removal ---
    // private scheduleRemoval(operationId: string, delayMs: number = 60000): void {
    //     setTimeout(() => {
    //         this.removeOperation(operationId);
    //     }, delayMs);
    // }
}