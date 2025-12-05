import React from 'react';
import { WorkbookPage, TextBlock, ImageBlock } from '../../types/workbookTypes';
import MonthlyPlannerRenderer from './renderers/MonthlyPlannerRenderer';
import HabitTrackerRenderer from './renderers/HabitTrackerRenderer';

interface WorkbookPageRendererProps {
    page: WorkbookPage;
}

const WorkbookPageRenderer: React.FC<WorkbookPageRendererProps> = ({ page }) => {
    const { layout, textBlocks, imageBlocks, type } = page;

    const containerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#fff',
        overflow: 'hidden',
        aspectRatio: `${layout.widthPx} / ${layout.heightPx}`, // Fixed: using widthPx/heightPx instead of pxWidth/pxHeight
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    };

    const renderContent = () => {
        // Specialized Renderers
        if (type === 'MONTHLY_PLANNER' && page.monthlyData) {
            return <MonthlyPlannerRenderer data={page.monthlyData} layout={layout} />;
        }

        if (type === 'HABIT_TRACKER' && page.habitTracker) {
            return <HabitTrackerRenderer data={page.habitTracker} layout={layout} />;
        }

        // Default / Generic Renderer (Text & Images)
        return (
            <>
                {imageBlocks?.map((block) => (
                    <ImageBlockRenderer key={block.id} block={block} />
                ))}
                {textBlocks?.map((block) => (
                    <TextBlockRenderer key={block.id} block={block} />
                ))}
            </>
        );
    };

    return (
        <div className="workbook-page-render" style={containerStyle}>
            {renderContent()}
        </div>
    );
};

const TextBlockRenderer: React.FC<{ block: TextBlock }> = ({ block }) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${block.position?.x}%`,
        top: `${block.position?.y}%`,
        transform: 'translate(-50%, -50%)',
        ...block.style
    };

    let className = 'wb-text-block';
    if (block.role === 'TITLE') className += ' wb-title text-4xl font-serif font-bold text-navy-900';
    if (block.role === 'SUBTITLE') className += ' wb-subtitle text-xl text-slate-600 font-sans uppercase tracking-widest';
    if (block.role === 'BODY') className += ' wb-body text-base text-slate-800 font-sans leading-relaxed';
    if (block.role === 'QUOTE') className += ' wb-quote text-2xl italic font-serif text-gold-600 text-center';

    return (
        <div className={className} style={style}>
            {block.content}
        </div>
    );
};

const ImageBlockRenderer: React.FC<{ block: ImageBlock }> = ({ block }) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${block.position?.x}%`,
        top: `${block.position?.y}%`,
        width: `${block.position?.w}%`,
        height: `${block.position?.h}%`,
        objectFit: 'cover',
        ...block.style
    };

    return (
        <img src={block.url || 'https://via.placeholder.com/300'} alt={block.alt || block.prompt} style={style} />
    );
};

export default WorkbookPageRenderer;
