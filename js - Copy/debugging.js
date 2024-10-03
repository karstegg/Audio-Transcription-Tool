export function createDebugger(isDebugMode) {
    let logs = [];

    function addLog(message) {
        if (isDebugMode) {
            logs.push(`${new Date().toISOString()}: ${message}`);
            console.log(message);
        }
    }

    function getLogs() {
        return [...logs];
    }

    function clearLogs() {
        logs = [];
    }

    return { addLog, getLogs, clearLogs };
}