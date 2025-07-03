import { ExecutionStatusEnum } from '../index.js';
import { OperationResult, ICrossChain } from '../types/interfaces/index.js';
import { EventEmitter } from 'eventemitter3';

export class OperationMonitor {
    private emitter = new EventEmitter();
    private trackedOperations: Map<string, OperationResult> = new Map();

    constructor(private adapter: ICrossChain) {
        console.log('[OperationMonitor] Listening for adapter status events');
        this.adapter.on('status', (statusUpdate) => {
            console.log('📊 [MONITOR] Received status event:', statusUpdate.operationId, statusUpdate.status);
            this.updateOperationStatus(statusUpdate.operationId, statusUpdate);
        });
    }

    registerOperation(operationId: string, initialStatus: OperationResult): void {
        console.log('📊 [MONITOR] Registering operation:', operationId);
        this.trackedOperations.set(operationId, { ...initialStatus });

        // ✅ NO POLLING! Events will handle everything
        console.log('📊 [MONITOR] Operation registered - relying on events only');
    }

    updateOperationStatus(id: string, statusUpdate: Partial<OperationResult>) {
        console.log('📊 [MONITOR] Updating status for:', id, 'new status:', statusUpdate.status);

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

        console.log('📊 [MONITOR] Status updated, emitting statusUpdate event');
        this.emitter.emit('statusUpdate', updated);
    }

    async forceStatusCheck(operationId: string): Promise<void> {
        console.log('📊 [MONITOR] Force checking status for:', operationId);
        try {
            const freshStatus = await this.adapter.getOperationStatus(operationId);
            if (freshStatus) {
                this.updateOperationStatus(operationId, freshStatus);
            }
        } catch (error) {
            console.error('📊 [MONITOR] Force check failed:', error);
        }
    }

    onStatusUpdate(cb: (op: OperationResult) => void) {
        console.log('📊 [MONITOR] Adding status update listener');
        this.emitter.on('statusUpdate', cb);
    }

    offStatusUpdate(cb: (op: OperationResult) => void) {
        this.emitter.off('statusUpdate', cb);
    }

    getOperationStatus(operationId: string): OperationResult | undefined {
        const status = this.trackedOperations.get(operationId);
        console.log('📊 [MONITOR] Getting status for:', operationId, 'found:', status?.status);
        return status;
    }

    isTerminalStatus(status: string): boolean {
        return ['COMPLETED', 'FAILED'].includes(status);
    }

    removeOperation(operationId: string): boolean {
        return this.trackedOperations.delete(operationId);
    }

    clearAllOperations(): void {
        this.trackedOperations.clear();
    }
}