import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl } from '../services/imageService';

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean; // If true, load immediately (no lazy load)
}

const OptimizedImage: React.FC<Props> = ({
    src,
    alt,
    width = 800,
    height,
    className = '',
    priority = false,
    ...props
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(priority);
    const [error, setError] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Intersection Observer for lazy loading
    useEffect(() => {
        if (priority) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.disconnect();
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading when 50px away from viewport
                threshold: 0.1
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, [priority]);

    const optimizedUrl = getOptimizedImageUrl(src, width, height);

    return (
        <div
            className={`relative overflow-hidden bg-gray-100 ${className}`}
            style={{ minHeight: height ? `${height}px` : 'auto' }}
        >
            {/* Placeholder / Blur Effect */}
            <div
                className={`absolute inset-0 bg-gray-200 transition-opacity duration-500 ${isLoaded ? 'opacity-0' : 'opacity-100'
                    }`}
                aria-hidden="true"
            />

            {/* Actual Image */}
            {isInView && (
                <img
                    ref={imgRef}
                    src={error ? src : optimizedUrl} // Fallback to original if optimized fails
                    alt={alt}
                    className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'
                        } ${className}`}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setError(true)}
                    loading={priority ? 'eager' : 'lazy'}
                    {...props}
                />
            )}

            {/* Error Fallback UI (Optional) */}
            {error && !isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            )}
        </div>
    );
};

export default OptimizedImage;
