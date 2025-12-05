
import React, { useState, useEffect } from 'react';
import { WorkbookTemplate, VisionImage, Habit, ShippingAddress } from '../../types';
import {
    BookOpenIcon,
    CheckBadgeIcon,
    SparklesIcon,
    LockIcon,
    TruckIcon,
    PenIcon,
    RefreshIcon
} from '../Icons';
import {
    getWorkbookTemplates,
    getVisionGallery,
    getHabits,
    getLastShippingAddress,
    createWorkbookOrder,
    createStripeCheckoutSession
} from '../../services/storageService';
import { generateWorkbookContent } from '../../services/geminiService';
import { buildInitialWorkbookPages } from '../../services/workbook/workbookService';
import { WorkbookPage } from '../../types/workbookTypes';
import WorkbookPreview from './WorkbookPreview';
import WorkbookCoverDesigner from './WorkbookCoverDesigner';
import './workbook.css';

type WizardStep = 'TYPE_SELECTION' | 'PERSONALIZE' | 'CONTENT' | 'PREVIEW' | 'PRINT';

interface Props {
    onClose: () => void;
}

const WorkbookWizard: React.FC<Props> = ({ onClose }) => {
    const [step, setStep] = useState<WizardStep>('TYPE_SELECTION');
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Data
    const [templates, setTemplates] = useState<WorkbookTemplate[]>([]);
    const [visionBoards, setVisionBoards] = useState<VisionImage[]>([]);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [generatedPages, setGeneratedPages] = useState<WorkbookPage[]>([]);

    // Selections
    const [selectedTemplate, setSelectedTemplate] = useState<WorkbookTemplate | null>(null);
    const [selectedVisionBoards, setSelectedVisionBoards] = useState<string[]>([]);
    const [selectedHabits, setSelectedHabits] = useState<string[]>([]);

    // Customization
    const [title, setTitle] = useState('My Vision Workbook');
    const [subtitle, setSubtitle] = useState(new Date().getFullYear().toString());
    const [dedication, setDedication] = useState('');
    const [leatherColor, setLeatherColor] = useState<'black' | 'brown' | 'navy'>('black');
    const [embossStyle, setEmbossStyle] = useState<'gold' | 'silver' | 'blind'>('gold');

    // Content Config
    const [includeCalendar, setIncludeCalendar] = useState(true);
    const [includeHabits, setIncludeHabits] = useState(true);
    const [includeJournal, setIncludeJournal] = useState(true);
    const [includeFinancial, setIncludeFinancial] = useState(true);
    const [includeForeword, setIncludeForeword] = useState(true);

    // Shipping
    const [shipping, setShipping] = useState<ShippingAddress>({
        name: '', line1: '', city: '', state: '', postalCode: '', country: 'US'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [templatesData, visionData, habitsData, lastAddress] = await Promise.all([
                getWorkbookTemplates(),
                getVisionGallery(),
                getHabits(),
                getLastShippingAddress()
            ]);

            // Mock Executive Template if not in DB yet
            const executiveTemplate: WorkbookTemplate = {
                id: 'executive-leather',
                name: 'Executive Vision Planner',
                description: 'Premium matte black leather with gold foil debossing. The ultimate tool for the visionary leader.',
                sku: 'EXEC-LEATHER-7x9',
                page_count: 240,
                size: '7x9',
                binding: 'hardcover',
                base_price: 89.00,
                shipping_estimate: 12.99,
                features: ['Genuine Italian Leather', 'Gold Foil Debossing', '120gsm Ivory Paper', 'Lay-flat Binding'],
                is_active: true,
                sort_order: 1,
                created_at: new Date().toISOString()
            };

            setTemplates([...templatesData, executiveTemplate]);
            setVisionBoards(visionData);
            setHabits(habitsData);
            if (lastAddress) setShipping(lastAddress);

            // Auto-select recent visions
            setSelectedVisionBoards(visionData.slice(0, 5).map(v => v.id));
            setSelectedHabits(habitsData.map(h => h.id));

        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateAIContent = async () => {
        setIsGenerating(true);
        try {
            // Generate dedication if empty
            if (!dedication) {
                const generatedDedication = await generateWorkbookContent('dedication', {
                    name: shipping.name,
                    targetYear: subtitle
                });
                setDedication(generatedDedication);
            }
        } catch (error) {
            console.error("AI Generation failed", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-8 space-x-4">
            {['Type', 'Personalize', 'Content', 'Preview', 'Print'].map((label, idx) => {
                const stepIdx = ['TYPE_SELECTION', 'PERSONALIZE', 'CONTENT', 'PREVIEW', 'PRINT'].indexOf(step);
                const isActive = idx === stepIdx;
                const isCompleted = idx < stepIdx;

                return (
                    <div key={label} className="flex items-center">
                        <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
              ${isActive ? 'bg-navy-900 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}
            `}>
                            {isCompleted ? '✓' : idx + 1}
                        </div>
                        <span className={`ml-2 text-sm ${isActive ? 'font-bold text-navy-900' : 'text-gray-500'}`}>
                            {label}
                        </span>
                        {idx < 4 && <div className="w-8 h-0.5 bg-gray-200 ml-4" />}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-serif font-bold text-navy-900">Workbook Builder</h1>
                    <button onClick={onClose} className="text-gray-500 hover:text-navy-900">
                        Close
                    </button>
                </div>

                {renderStepIndicator()}

                {/* Step Content */}
                <div className="bg-white rounded-2xl shadow-xl min-h-[600px] p-8">

                    {step === 'TYPE_SELECTION' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    onClick={() => { setSelectedTemplate(template); setStep('PERSONALIZE'); }}
                                    className="border-2 border-gray-100 rounded-xl p-6 cursor-pointer hover:border-navy-900 hover:shadow-xl transition-all group relative overflow-hidden"
                                >
                                    {template.id === 'executive-leather' && (
                                        <div className="absolute top-0 right-0 bg-gold-500 text-navy-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                                            PREMIUM
                                        </div>
                                    )}
                                    <div className="h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                                        <BookOpenIcon className="w-16 h-16 text-gray-400 group-hover:text-navy-900 transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-navy-900 mb-2">{template.name}</h3>
                                    <p className="text-gray-500 text-sm mb-4">{template.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-2xl font-bold text-navy-900">${template.base_price}</span>
                                        <span className="text-sm text-gray-500">{template.size}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'PERSONALIZE' && selectedTemplate && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div>
                                <h2 className="text-2xl font-bold text-navy-900 mb-6">Customize Your Cover</h2>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-navy-900 mb-2">Workbook Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            className="w-full border rounded-lg p-3"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-navy-900 mb-2">Subtitle / Year</label>
                                        <input
                                            type="text"
                                            value={subtitle}
                                            onChange={e => setSubtitle(e.target.value)}
                                            className="w-full border rounded-lg p-3"
                                        />
                                    </div>

                                    {selectedTemplate.id === 'executive-leather' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-bold text-navy-900 mb-2">Leather Color</label>
                                                <div className="flex gap-4">
                                                    {['black', 'brown', 'navy'].map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setLeatherColor(color as any)}
                                                            className={`w-12 h-12 rounded-full border-4 ${leatherColor === color ? 'border-gold-500' : 'border-transparent'}`}
                                                            style={{ backgroundColor: color === 'navy' ? '#1a237e' : color === 'brown' ? '#5d4037' : '#000' }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-navy-900 mb-2">Embossing Style</label>
                                                <div className="flex gap-4">
                                                    {['gold', 'silver', 'blind'].map(style => (
                                                        <button
                                                            key={style}
                                                            onClick={() => setEmbossStyle(style as any)}
                                                            className={`px-4 py-2 rounded-lg border ${embossStyle === style ? 'bg-navy-900 text-white' : 'bg-white text-gray-700'}`}
                                                        >
                                                            {style.charAt(0).toUpperCase() + style.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-navy-900">Dedication</label>
                                            <button
                                                onClick={handleGenerateAIContent}
                                                disabled={isGenerating}
                                                className="text-xs text-gold-600 flex items-center gap-1 hover:text-gold-700"
                                            >
                                                <SparklesIcon className="w-3 h-3" />
                                                {isGenerating ? 'Writing...' : 'AI Generate'}
                                            </button>
                                        </div>
                                        <textarea
                                            value={dedication}
                                            onChange={e => setDedication(e.target.value)}
                                            className="w-full border rounded-lg p-3 h-24"
                                            placeholder="To my future self..."
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={() => setStep('CONTENT')}
                                    className="mt-8 w-full bg-navy-900 text-white font-bold py-4 rounded-xl hover:bg-navy-800 transition-colors"
                                >
                                    Next: Select Content
                                </button>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-8 flex items-center justify-center">
                                <WorkbookCoverDesigner
                                    template={selectedTemplate}
                                    title={title}
                                    subtitle={subtitle}
                                    leatherColor={leatherColor}
                                    embossStyle={embossStyle}
                                />
                            </div>
                        </div>
                    )}

                    {step === 'CONTENT' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-8">
                                <div>
                                    <h2 className="text-2xl font-bold text-navy-900 mb-4">Select Vision Boards</h2>
                                    <div className="grid grid-cols-3 gap-4">
                                        {visionBoards.map(vision => (
                                            <div
                                                key={vision.id}
                                                onClick={() => {
                                                    setSelectedVisionBoards(prev =>
                                                        prev.includes(vision.id) ? prev.filter(id => id !== vision.id) : [...prev, vision.id]
                                                    );
                                                }}
                                                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-4 transition-all ${selectedVisionBoards.includes(vision.id) ? 'border-navy-900' : 'border-transparent'
                                                    }`}
                                            >
                                                <img src={vision.url} className="w-full h-full object-cover" />
                                                {selectedVisionBoards.includes(vision.id) && (
                                                    <div className="absolute top-2 right-2 bg-navy-900 text-white rounded-full p-1">
                                                        <CheckBadgeIcon className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h2 className="text-2xl font-bold text-navy-900 mb-4">Included Sections</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { id: 'calendar', label: 'Monthly Planner', state: includeCalendar, set: setIncludeCalendar },
                                            { id: 'habits', label: 'Habit Tracker', state: includeHabits, set: setIncludeHabits },
                                            { id: 'journal', label: '52-Week Journal', state: includeJournal, set: setIncludeJournal },
                                            { id: 'finance', label: 'Financial Goals', state: includeFinancial, set: setIncludeFinancial },
                                            { id: 'foreword', label: 'AI Foreword (Ghostwriter)', state: includeForeword, set: setIncludeForeword },
                                        ].map(section => (
                                            <label key={section.id} className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={section.state}
                                                    onChange={e => section.set(e.target.checked)}
                                                    className="w-5 h-5 text-navy-900 rounded"
                                                />
                                                <span className="font-medium text-navy-900">{section.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-6 h-fit">
                                <h3 className="font-bold text-navy-900 mb-4">Workbook Summary</h3>
                                <div className="space-y-2 text-sm text-gray-600 mb-6">
                                    <div className="flex justify-between">
                                        <span>Pages</span>
                                        <span className="font-bold">~{selectedTemplate?.page_count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Vision Boards</span>
                                        <span className="font-bold">{selectedVisionBoards.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Habits</span>
                                        <span className="font-bold">{selectedHabits.length}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        setIsGenerating(true);
                                        try {
                                            const pages = await buildInitialWorkbookPages({
                                                edition: 'EXECUTIVE_VISION_BOOK',
                                                trimSize: 'TRADE_6x9',
                                                goals: [], // TODO: Pass real goals
                                                habits: selectedHabits,
                                                visionBoardImages: selectedVisionBoards,
                                                includeForeword
                                            });
                                            console.log(`WorkbookWizard: Generated ${pages.length} pages`);
                                            setGeneratedPages(pages);
                                            setStep('PREVIEW');
                                        } catch (e) {
                                            console.error("WorkbookWizard: Generation failed", e);
                                        } finally {
                                            setIsGenerating(false);
                                        }
                                    }}
                                    className="w-full bg-navy-900 text-white font-bold py-3 rounded-lg hover:bg-navy-800"
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? 'Generating Blueprint...' : 'Generate Preview'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'PREVIEW' && (
                        <div className="h-full flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-navy-900">Digital Preview</h2>
                                <div className="flex gap-4">
                                    <button onClick={() => setStep('CONTENT')} className="text-gray-500 hover:text-navy-900">Back to Content</button>
                                    <button
                                        onClick={() => setStep('PRINT')}
                                        className="bg-navy-900 text-white font-bold px-6 py-2 rounded-lg hover:bg-navy-800"
                                    >
                                        Approve & Print
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden relative">
                                <WorkbookPreview pages={generatedPages} />
                            </div>
                        </div>
                    )}

                    {step === 'PRINT' && (
                        <div className="max-w-2xl mx-auto text-center py-12">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckBadgeIcon className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-navy-900 mb-4">Ready to Print</h2>
                            <p className="text-gray-500 mb-8">
                                Your workbook is ready. We will generate a high-resolution PDF and send it to our premium print partner, Prodigi.
                            </p>

                            <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left max-w-md mx-auto">
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">Product</span>
                                    <span className="font-bold text-navy-900">{selectedTemplate?.name}</span>
                                </div>
                                <div className="flex justify-between mb-2">
                                    <span className="text-gray-600">Total</span>
                                    <span className="font-bold text-navy-900">${selectedTemplate?.base_price}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>Estimated Delivery</span>
                                    <span>7-10 Business Days</span>
                                </div>
                            </div>

                            <button
                                onClick={async () => {
                                    if (!selectedTemplate) return;
                                    setIsLoading(true);
                                    try {
                                        const order = await createWorkbookOrder({
                                            template_id: selectedTemplate.id,
                                            title,
                                            subtitle,
                                            dedication_text: dedication,
                                            cover_style: JSON.stringify({ leatherColor, embossStyle }),
                                            include_weekly_journal: includeJournal,
                                            include_habit_tracker: includeHabits,
                                            vision_board_ids: selectedVisionBoards,
                                            included_habits: selectedHabits,
                                            shipping_address: shipping,
                                            include_foreword: includeForeword,
                                            included_sections: [
                                                ...(includeCalendar ? ['monthly_planner'] : []),
                                                ...(includeHabits ? ['habit_tracker'] : []),
                                                ...(includeJournal ? ['weekly_journal'] : []),
                                                ...(includeFinancial ? ['financial_snapshot', 'goal_overview'] : []),
                                                ...(includeForeword ? ['coach_letter'] : [])
                                            ]
                                        });

                                        if (order) {
                                            const url = await createStripeCheckoutSession('payment', order.id);
                                            if (url) window.location.href = url;
                                        }
                                    } catch (error) {
                                        console.error("Checkout failed", error);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                                className="bg-navy-900 text-white font-bold py-4 px-12 rounded-xl hover:bg-navy-800 shadow-lg transition-all disabled:opacity-50"
                            >
                                {isLoading ? 'Processing...' : 'Proceed to Checkout'}
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default WorkbookWizard;
