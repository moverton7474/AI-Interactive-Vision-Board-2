
import React from 'react';
import { WorkbookTemplate } from '../../types';

interface Props {
    template: WorkbookTemplate;
    title: string;
    subtitle: string;
    leatherColor: 'black' | 'brown' | 'navy';
    embossStyle: 'gold' | 'silver' | 'blind';
}

const WorkbookCoverDesigner: React.FC<Props> = ({
    template,
    title,
    subtitle,
    leatherColor,
    embossStyle
}) => {

    const getLeatherColor = () => {
        switch (leatherColor) {
            case 'navy': return '#1a237e';
            case 'brown': return '#5d4037';
            case 'black': return '#212121';
            default: return '#212121';
        }
    };

    const getTextStyle = () => {
        if (embossStyle === 'blind') {
            return {
                color: 'rgba(0,0,0,0.3)',
                textShadow: '1px 1px 0px rgba(255,255,255,0.1), -1px -1px 0px rgba(0,0,0,0.5)'
            };
        } else if (embossStyle === 'gold') {
            return {
                background: 'linear-gradient(45deg, #BF953F, #FCF6BA, #B38728, #FBF5B7, #AA771C)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            };
        } else { // Silver
            return {
                background: 'linear-gradient(45deg, #A0A0A0, #E0E0E0, #A0A0A0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
            };
        }
    };

    return (
        <div className="relative w-[400px] h-[560px] rounded-r-2xl shadow-2xl transform transition-transform hover:scale-105 duration-500"
            style={{
                backgroundColor: getLeatherColor(),
                boxShadow: 'inset 10px 0 20px rgba(0,0,0,0.5), 20px 20px 40px rgba(0,0,0,0.4)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
            }}
        >
            {/* Spine Shadow */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/40 to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">

                {/* Logo / Icon */}
                <div className="mb-12 opacity-80">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={embossStyle === 'blind' ? 'rgba(0,0,0,0.3)' : embossStyle === 'gold' ? '#D4AF37' : '#C0C0C0'} strokeWidth="1">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                </div>

                <h1
                    className="text-4xl font-serif font-bold tracking-wider mb-4 uppercase"
                    style={getTextStyle()}
                >
                    {title}
                </h1>

                <div className="w-16 h-0.5 bg-white/20 mb-4" />

                <h2
                    className="text-xl font-light tracking-widest uppercase"
                    style={getTextStyle()}
                >
                    {subtitle}
                </h2>

                {/* Bottom Branding */}
                <div className="absolute bottom-12 text-xs tracking-[0.3em] opacity-50 text-white">
                    VISIONARY
                </div>
            </div>
        </div>
    );
};

export default WorkbookCoverDesigner;
