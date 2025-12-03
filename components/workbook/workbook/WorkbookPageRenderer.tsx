import React from 'react';
import { WorkbookPage, WorkbookTextBlock, WorkbookImageBlock } from '../../types/workbookTypes';

interface WorkbookPageRendererProps {
    page: WorkbookPage;
}

const WorkbookPageRenderer: React.FC<WorkbookPageRendererProps> = ({ page }) => {
    const { layout, textBlocks, imageBlocks } = page;

    const containerStyle: React.CSSProperties = {
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#fff',
        overflow: 'hidden',
        aspectRatio: `${layout.pxWidth} / ${layout.pxHeight}`,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    };

    return (
        <div className="workbook-page-render" style={containerStyle}>
            {imageBlocks.map((block) => (
                <ImageBlock key={block.id} block={block} />
            ))}
            {textBlocks.map((block) => (
                <TextBlock key={block.id} block={block} />
            ))}
        </div>
    );
};

const TextBlock: React.FC<{ block: WorkbookTextBlock }> = ({ block }) => {
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${block.position?.x}%`,
        top: `${block.position?.y}%`,
        transform: 'translate(-50%, -50%)',
        ...block.style
    };

    let className = 'wb-text-block';
    if (block.role === 'title') className += ' wb-title';
    if (block.role === 'subtitle') className += ' wb-subtitle';
    if (block.role === 'body') className += ' wb-body';

    return (
        <div className={className} style={style}>
            {block.content}
        </div>
    );
};

const ImageBlock: React.FC<{ block: WorkbookImageBlock }> = ({ block }) => {
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
        <img src={block.url || 'https://via.placeholder.com/300'} alt={block.prompt} style={style} />
    );
};

export default WorkbookPageRenderer;
