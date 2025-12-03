import React, { useState } from 'react';
import { buildInitialWorkbookPages } from '../../services/workbook/workbookService';
import { WorkbookPage, WorkbookEdition } from '../../types/workbookTypes';
import WorkbookPageRenderer from './WorkbookPageRenderer';
import './workbook.css';

const WorkbookWizard: React.FC = () => {
    const [step, setStep] = useState(1);
    const [edition, setEdition] = useState<WorkbookEdition>('EXECUTIVE_BLACK');
    const [pages, setPages] = useState<WorkbookPage[]>([]);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const generatedPages = await buildInitialWorkbookPages({
                edition,
                trimSize: '7x9',
                goals: ['Increase Revenue', 'Health Optimization'],
                habits: ['Morning Run', 'Deep Work'],
                visionBoardImages: []
            });
            setPages(generatedPages);
            setStep(2);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="workbook-app">
            <header className="app-header">
                <div className="header-content">
                    <h1 className="brand-title">VISIONARY EXECUTIVE</h1>
                    <nav>
                        <span className="step-indicator">Step {step} of 5</span>
                    </nav>
                </div>
            </header>

            <main className="app-main">
                {step === 1 && (
                    <div className="wizard-step step-selection">
                        <h2 className="step-title">Select Your Edition</h2>
                        <div className="edition-grid">
                            <button
                                onClick={() => setEdition('EXECUTIVE_BLACK')}
                                className={`edition-card ${edition === 'EXECUTIVE_BLACK' ? 'selected' : ''}`}
                            >
                                <div className="edition-preview black-preview"></div>
                                <h3 className="edition-name">Executive Black</h3>
                                <p className="edition-desc">Minimalist matte black leather</p>
                            </button>
                            <button
                                onClick={() => setEdition('COGNAC_LEATHER')}
                                className={`edition-card ${edition === 'COGNAC_LEATHER' ? 'selected' : ''}`}
                            >
                                <div className="edition-preview cognac-preview"></div>
                                <h3 className="edition-name">Cognac Leather</h3>
                                <p className="edition-desc">Warm, premium portfolio style</p>
                            </button>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Generating Blueprint...' : 'Create My Workbook'}
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="wizard-step step-preview">
                        <div className="step-header">
                            <h2 className="step-title">Your Workbook Preview</h2>
                            <button onClick={() => setStep(1)} className="link-back">Back to Edit</button>
                        </div>

                        <div className="pages-grid">
                            {pages.map((page) => (
                                <div key={page.id} className="page-preview-container">
                                    <div className="page-aspect-wrapper">
                                        <WorkbookPageRenderer page={page} />
                                    </div>
                                    <p className="page-label">{page.type}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WorkbookWizard;
