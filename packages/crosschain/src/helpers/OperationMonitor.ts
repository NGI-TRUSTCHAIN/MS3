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