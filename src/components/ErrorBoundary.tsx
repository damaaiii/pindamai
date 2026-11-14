import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kendala saat menampilkan halaman ini.',
    };
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-3xl bg-white border border-[#EADFD5] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FCE9ED] text-[#A83B5A] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[#2B2226]">
              {this.props.fallbackTitle || 'Waduh, tampilannya sempat tersandung nih!'}
            </h2>
            <p className="text-sm text-[#5C4B51] max-w-md mx-auto">
              Tenang, data kamu aman kok di browser. Klik tombol di bawah buat memuat ulang ya!
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRecover}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
