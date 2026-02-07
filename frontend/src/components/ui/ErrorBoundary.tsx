
import { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
    autoRetry?: boolean;
    autoRetryDelay?: number;
    sectionName?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    retryCount: number;
    isRetrying: boolean;
}

const MAX_AUTO_RETRIES = 3;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    private retryTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            retryCount: 0,
            isRetrying: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);

        // Auto-retry logic
        if (this.props.autoRetry && this.state.retryCount < MAX_AUTO_RETRIES) {
            this.scheduleRetry();
        }
    }

    componentWillUnmount(): void {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }
    }

    scheduleRetry = (): void => {
        const delay = this.props.autoRetryDelay ?? 3000;
        this.setState({ isRetrying: true });

        this.retryTimeout = setTimeout(() => {
            this.handleRetry();
        }, delay);
    };

    handleRetry = (): void => {
        this.setState(prev => ({
            hasError: false,
            error: null,
            retryCount: prev.retryCount + 1,
            isRetrying: false,
        }));
    };

    handleManualRetry = (): void => {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
        }
        this.setState({
            hasError: false,
            error: null,
            retryCount: 0,
            isRetrying: false,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { sectionName, autoRetry } = this.props;
            const { isRetrying, retryCount } = this.state;

            return (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 dark:bg-red-900/20 rounded-[2rem] p-6 border-2 border-red-100 dark:border-red-800"
                >
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-800/50 rounded-xl flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" />
                        </div>

                        <h3 className="font-display font-bold text-lg text-red-800 dark:text-red-200 mb-2">
                            {sectionName ? `Error in ${sectionName}` : 'Something went wrong'}
                        </h3>

                        <p className="text-sm text-red-600 dark:text-red-300 mb-4 max-w-[250px]">
                            {isRetrying
                                ? `Retrying automatically... (attempt ${retryCount + 1}/${MAX_AUTO_RETRIES})`
                                : autoRetry && retryCount >= MAX_AUTO_RETRIES
                                    ? 'Auto-retry limit reached. Please try manually.'
                                    : 'We hit a snag loading this section.'}
                        </p>

                        <button
                            onClick={this.handleManualRetry}
                            disabled={isRetrying}
                            className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                            {isRetrying ? 'Retrying...' : 'Try Again'}
                        </button>
                    </div>
                </motion.div>
            );
        }

        return this.props.children;
    }
}

// Functional wrapper for easier use with hooks
interface ErrorBoundaryWrapperProps extends Omit<ErrorBoundaryProps, 'children'> {
    children: ReactNode;
}

export function WithErrorBoundary({ children, ...props }: ErrorBoundaryWrapperProps) {
    return <ErrorBoundary {...props}>{children}</ErrorBoundary>;
}
