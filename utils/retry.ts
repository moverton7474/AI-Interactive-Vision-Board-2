/**
 * Retries an async operation with exponential backoff.
 * 
 * @param operation The async function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param baseDelay Base delay in ms (default: 1000)
 * @returns The result of the operation
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;

            if (attempt === maxRetries) {
                break;
            }

            // Exponential backoff: 1s, 2s, 4s, etc.
            const delay = baseDelay * Math.pow(2, attempt);
            console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, error);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}
