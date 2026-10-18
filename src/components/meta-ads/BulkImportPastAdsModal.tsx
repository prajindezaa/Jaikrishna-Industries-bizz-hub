/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Trash2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { MetaAd, MetaAdResults } from '../../types';
import {
  parseIndianNumber,
  parseFlexibleDate,
  formatINR,
  formatIndianNumber,
  calculateCostPerConversation,
  calculateFrequency,
  calculateCtr,
} from '../../lib/meta-ads-utils';

interface BulkImportPastAdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ParsedImportRow {
  rowNum: number;
  adName: string;
  goal: string;
  occasion: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  totalSpent: number | null;
  dailyBudget: number | null;
  placements: string[];
  conversations: number | null;
  views: number | null;
  viewers: number | null;
  linkClicks: number | null;
  engagements: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  lessons: string;
  rating: number | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

export const BulkImportPastAdsModal: React.FC<BulkImportPastAdsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { member } = useAuth();
  const { metaAds, importPastAdsBatch, undoPastAdsBatch, activityLogs } = useApp();

  const [activeTab, setActiveTab] = useState<'import' | 'undo'>('import');
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');

  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);
  const [duplicateResolution, setDuplicateResolution] = useState<'skip' | 'import_anyway'>('import_anyway');

  // Column mapping state: maps standard target field -> raw header index
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ count: number; batchId: string } | null>(null);

  // Undo batch state
  const [undoBatchId, setUndoBatchId] = useState('');
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoSuccessMessage, setUndoSuccessMessage] = useState<string | null>(null);

  // Recent import batches extracted from metaAds
  const recentBatches = useMemo(() => {
    const batchesMap = new Map<string, { batchId: string; count: number; latestDate: string }>();
    metaAds.forEach((ad) => {
      if (ad.isHistorical && ad.importBatchId && !ad.isDeleted) {
        const prev = batchesMap.get(ad.importBatchId);
        if (prev) {
          prev.count += 1;
        } else {
          batchesMap.set(ad.importBatchId, {
            batchId: ad.importBatchId,
            count: 1,
            latestDate: ad.createdAt || new Date().toISOString(),
          });
        }
      }
    });
    return Array.from(batchesMap.values()).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [metaAds]);


  // 1. Download Master Excel Template with Instructions sheet
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'Ad Name': 'Diwali 2025 Bhimseni Camphor Wholesale',
        'Goal': 'Messages/Conversations',
        'Occasion': 'Diwali 2025',
        'Start Date (DD/MM/YYYY)': '15/10/2025 09:00',
        'End Date (DD/MM/YYYY)': '28/10/2025 21:00',
        'Total Spent (INR)': '15,000',
        'Daily Budget (INR)': '1,200',
        'Placements': 'Facebook Feed, Instagram Feed, Reels',
        'Messaging Conversations Started': '142',
        'Impressions (Views)': '45,000',
        'Reach (Viewers)': '32,000',
        'Link Clicks': '1,120',
        'Post Engagements': '2,400',
        'Post Reactions': '1,800',
        'Post Comments': '450',
        'Post Shares': '120',
        'Post Saves': '30',
        'Lessons / Notes': 'Festival packaging visual gave 2.8x higher response than static image.',
        'Rating (1-5)': '5',
      },
      {
        'Ad Name': 'Panguni Uthiram 2025 Temple Supply Special',
        'Goal': 'Messages/Conversations',
        'Occasion': 'Panguni Uthiram',
        'Start Date (DD/MM/YYYY)': '05/03/2025 08:00',
        'End Date (DD/MM/YYYY)': '18/03/2025 20:00',
        'Total Spent (INR)': '12,500',
        'Daily Budget (INR)': '1,000',
        'Placements': 'Instagram Feed, Facebook Feed',
        'Messaging Conversations Started': '88',
        'Impressions (Views)': '28,500',
        'Reach (Viewers)': '22,000',
        'Link Clicks': '750',
        'Post Engagements': '1,200',
        'Post Reactions': '950',
        'Post Comments': '180',
        'Post Shares': '50',
        'Post Saves': '20',
        'Lessons / Notes': 'Direct temple trust inquiries from Madurai and Tirunelveli.',
        'Rating (1-5)': '4',
      },
    ];

    const wsData = XLSX.utils.json_to_sheet(sampleRows);

    const instructions = [
      ['JAIKRISHNA INDUSTRIES - PAST META ADS BULK IMPORT GUIDE'],
      [''],
      ['COLUMN RULES & SPECIFICATIONS:'],
      ['1. Ad Name (Required): Unique campaign title.'],
      ['2. Start Date & End Date (Required): Formatted as DD/MM/YYYY HH:mm or YYYY-MM-DD. End date must be on or before today.'],
      ['3. Total Spent (INR) (Required): Actual spend invoiced by Meta. Accepts Indian numbering like 15,000 or ₹15,000.'],
      ['4. Optional Results: Leave blank for "Not recorded" (—) state. Real 0 is stored as 0.'],
      ['5. One-Customer-One-Ad Rule: Customer attribution can be linked from the ad detail page or during customer import using Campaign Name.'],
      ['6. Undo: An import batch ID is attached to all imported ads so the batch can be cleanly moved to Trash in one click.'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'Past Ads Template');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    XLSX.writeFile(wb, `jaikrishna-past-ads-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 2. File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!json || json.length < 2) {
          alert('File contains no data rows.');
          return;
        }

        const headers = (json[0] || []).map((h) => String(h).trim());
        const dataRows = json.slice(1).filter((r) => r.some((c) => c !== undefined && c !== ''));

        setRawHeaders(headers);
        setRawDataRows(dataRows);

        // Auto-detect columns (matching Meta Ads Manager and our template)
        const autoMap: Record<string, number> = {};
        headers.forEach((h, idx) => {
          const l = h.toLowerCase();
          if (l.includes('campaign name') || l.includes('ad name') || l === 'name') autoMap['name'] = idx;
          else if (l.includes('amount spent') || l.includes('total spent') || l.includes('spend') || l === 'cost') autoMap['totalSpent'] = idx;
          else if (l.includes('messaging conversations') || l.includes('conversations') || l.includes('results')) autoMap['conversations'] = idx;
          else if (l.includes('impressions') || l.includes('views')) autoMap['views'] = idx;
          else if (l.includes('reach') || l.includes('viewers')) autoMap['viewers'] = idx;
          else if (l.includes('link clicks') || l.includes('clicks')) autoMap['linkClicks'] = idx;
          else if (l.includes('post reactions') || l.includes('reactions')) autoMap['reactions'] = idx;
          else if (l.includes('post comments') || l.includes('comments')) autoMap['comments'] = idx;
          else if (l.includes('post shares') || l.includes('shares')) autoMap['shares'] = idx;
          else if (l.includes('post saves') || l.includes('saves')) autoMap['saves'] = idx;
          else if (l.includes('post engagements') || l.includes('engagements')) autoMap['engagements'] = idx;
          else if (l.includes('start date') || l.includes('reporting starts') || l === 'starts') autoMap['startDate'] = idx;
          else if (l.includes('end date') || l.includes('reporting ends') || l === 'ends') autoMap['endDate'] = idx;
          else if (l.includes('daily budget') || l.includes('budget')) autoMap['dailyBudget'] = idx;
          else if (l.includes('occasion') || l.includes('festival')) autoMap['occasion'] = idx;
          else if (l.includes('goal') || l.includes('objective')) autoMap['goal'] = idx;
          else if (l.includes('placements')) autoMap['placements'] = idx;
          else if (l.includes('lessons') || l.includes('notes')) autoMap['lessons'] = idx;
          else if (l.includes('rating')) autoMap['rating'] = idx;
        });

        setColumnMap(autoMap);
        setStep('mapping');
      } catch (err) {
        console.error('Failed to parse file:', err);
        alert('Could not read the uploaded spreadsheet. Please check format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // 3. Parse and Validate rows using current column mapping
  const parsedRows = useMemo<ParsedImportRow[]>(() => {
    if (rawDataRows.length === 0) return [];
    const nowMs = new Date().getTime();

    return rawDataRows.map((row, index) => {
      const rowNum = index + 2;
      const getVal = (fieldKey: string) => {
        const colIdx = columnMap[fieldKey];
        if (colIdx !== undefined && colIdx >= 0) {
          return row[colIdx];
        }
        return undefined;
      };

      const adName = String(getVal('name') || '').trim();
      const goal = String(getVal('goal') || 'Messages/Conversations').trim();
      const occasion = String(getVal('occasion') || '').trim();
      const rawStart = getVal('startDate');
      const rawEnd = getVal('endDate');
      const parsedStart = parseFlexibleDate(rawStart);
      const parsedEnd = parseFlexibleDate(rawEnd);

      const totalSpent = parseIndianNumber(getVal('totalSpent'));
      const dailyBudget = parseIndianNumber(getVal('dailyBudget'));
      const conversations = parseIndianNumber(getVal('conversations'));
      const views = parseIndianNumber(getVal('views'));
      const viewers = parseIndianNumber(getVal('viewers'));
      const linkClicks = parseIndianNumber(getVal('linkClicks'));
      const engagements = parseIndianNumber(getVal('engagements'));
      const reactions = parseIndianNumber(getVal('reactions'));
      const comments = parseIndianNumber(getVal('comments'));
      const shares = parseIndianNumber(getVal('shares'));
      const saves = parseIndianNumber(getVal('saves'));
      const lessons = String(getVal('lessons') || '').trim();
      const rating = parseIndianNumber(getVal('rating'));

      const rawPlacements = String(getVal('placements') || '').trim();
      const placements = rawPlacements ? rawPlacements.split(',').map((p) => p.trim()) : ['Facebook Feed', 'Instagram Feed'];

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validations
      if (!adName) errors.push('Ad Name is missing');

      if (!parsedStart.dateISO) {
        errors.push(parsedStart.error || 'Invalid or missing Start Date');
      }
      if (!parsedEnd.dateISO) {
        errors.push(parsedEnd.error || 'Invalid or missing End Date');
      }

      let durationDays = 1;
      if (parsedStart.dateISO && parsedEnd.dateISO) {
        const startMs = new Date(parsedStart.dateISO).getTime();
        const endMs = new Date(parsedEnd.dateISO).getTime();
        if (endMs <= startMs) {
          errors.push('End date must be strictly after start date');
        }
        if (endMs > nowMs) {
          errors.push('Past ads must have ended in the past (cannot end in the future)');
        }
        durationDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
      }

      if (totalSpent === null || totalSpent === undefined) {
        errors.push('Total Spent (₹) is required');
      } else if (totalSpent < 0) {
        errors.push('Total Spent cannot be negative');
      }

      // Negative check
      [
        { name: 'Conversations', val: conversations },
        { name: 'Views', val: views },
        { name: 'Viewers', val: viewers },
        { name: 'Link Clicks', val: linkClicks },
      ].forEach((m) => {
        if (m.val !== null && m.val < 0) errors.push(`${m.name} cannot be negative`);
      });

      // Duplicate check against existing live ads
      let isDuplicate = false;
      if (adName && parsedStart.dateISO && parsedEnd.dateISO) {
        const cleanName = adName.toLowerCase();
        const sMs = new Date(parsedStart.dateISO).getTime();
        const eMs = new Date(parsedEnd.dateISO).getTime();

        const match = metaAds.find((other) => {
          if (other.isDeleted) return false;
          if (other.name.trim().toLowerCase() !== cleanName) return false;
          const oStart = new Date(other.plannedStart).getTime();
          const oEnd = new Date(other.plannedEnd).getTime();
          return sMs <= oEnd && eMs >= oStart;
        });

        if (match) {
          isDuplicate = true;
          warnings.push(`Matches existing ad "${match.name}" (${match.plannedStart.slice(0, 10)})`);
        }
      }

      return {
        rowNum,
        adName,
        goal,
        occasion,
        startDate: parsedStart.dateISO || '',
        endDate: parsedEnd.dateISO || '',
        durationDays,
        totalSpent,
        dailyBudget,
        placements,
        conversations,
        views,
        viewers,
        linkClicks,
        engagements,
        reactions,
        comments,
        shares,
        saves,
        lessons,
        rating,
        isValid: errors.length === 0,
        errors,
        warnings,
        isDuplicate,
      };
    });
  }, [rawDataRows, columnMap, metaAds]);

  if (!isOpen) return null;

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const errorRowsCount = parsedRows.filter((r) => !r.isValid).length;

  // 4. Execute Batch Import
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    setStep('importing');

    try {
      const rowsToImport = parsedRows.filter((r) => {
        if (!r.isValid) return false;
        if (duplicateResolution === 'skip' && r.isDuplicate) return false;
        return true;
      });

      const batchId = `import_${Date.now()}`;
      const adsPayload = rowsToImport.map((r) => {
        const costPerConv = calculateCostPerConversation(r.totalSpent, r.conversations);
        const freq = calculateFrequency(r.views, r.viewers);
        const ctr = calculateCtr(r.linkClicks, r.views);

        const res: MetaAdResults = {
          conversations: r.conversations,
          costPerConversation: costPerConv,
          views: r.views,
          viewers: r.viewers,
          frequency: freq,
          totalSpent: r.totalSpent,
          dailyBudget: r.dailyBudget,
          actualDuration: r.durationDays,
          actualStart: r.startDate,
          actualEnd: r.endDate,
          engagements: r.engagements,
          reactions: r.reactions,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
          linkClicks: r.linkClicks,
          ctr,
          audienceAge: null,
          audienceGender: null,
          audiencePlaces: null,
          lessons: r.lessons || null,
          rating: r.rating || null,
        };

        const adData: Partial<MetaAd> = {
          name: r.adName,
          goal: r.goal,
          occasion: r.occasion,
          stage: 'Fulfilled',
          placements: r.placements,
          dailyBudget: r.dailyBudget ?? 0,
          totalBudget: r.totalSpent ?? 0,
          plannedStart: r.startDate,
          plannedEnd: r.endDate,
          durationDays: r.durationDays,
          createdBy: member?.email || 'admin',
          assignedTo: member?.email || 'admin',
          notes: r.lessons,
          results: res,
          isHistorical: true,
          importBatchId: batchId,
          isDraft: false,
        };

        return { adData };
      });

      const result = await importPastAdsBatch(adsPayload, batchId);
      setImportResult(result);
      onSuccess?.();
    } catch (err: any) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Undo Batch Handler
  const handleUndoBatch = async (batchId: string) => {
    if (!confirm(`Are you sure you want to undo batch ${batchId}? All ads in this batch will be moved to 30-day trash and customer links will be reset.`)) {
      return;
    }
    setIsUndoing(true);
    try {
      const count = await undoPastAdsBatch(batchId);
      setUndoSuccessMessage(`Successfully moved ${count} imported ads from batch ${batchId} to trash.`);
      setTimeout(() => setUndoSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Undo failed: ${err.message}`);
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 border border-blue-300 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-display flex items-center gap-2">
                <span>Bulk Import Past Ads (Excel / CSV)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-full">
                  Meta Export Compatible
                </span>
              </h2>
              <p className="text-xs text-stone-500">
                Import completed campaigns with results, validate dates &amp; Indian numbers, and undo anytime.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Import vs Undo Recent Batches */}
        <div className="px-6 py-2.5 bg-white border-b border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors ${
                activeTab === 'import' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Import Spreadsheet
            </button>
            <button
              onClick={() => setActiveTab('undo')}
              className={`px-3 py-1 font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'undo' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Recent Batches ({recentBatches.length})</span>
            </button>
          </div>

          {activeTab === 'import' && (
            <button
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Download Excel Template</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {activeTab === 'undo' && (
            <div className="space-y-4">
              {undoSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{undoSuccessMessage}</span>
                </div>
              )}

              <p className="text-stone-600 text-xs">
                Every bulk import receives a unique batch ID. If an import had mistakes or wrong columns, you can move all imported ads from that batch to the 30-day Trash in one action.
              </p>

              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden">
                {recentBatches.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">No bulk import batches found in current workspace.</div>
                ) : (
                  recentBatches.map((b) => (
                    <div key={b.batchId} className="p-3.5 bg-stone-50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-2">
                          <span className="font-mono">{b.batchId}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-mono">
                            {b.count} ad(s)
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                          Imported on {new Date(b.latestDate).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUndoBatch(b.batchId)}
                        disabled={isUndoing}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Move Batch to Trash</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <>
              {/* STEP 1: UPLOAD */}
              {step === 'upload' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl p-8 text-center space-y-3 transition-colors bg-stone-50/50">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">Upload Excel (.xlsx, .xls) or CSV file</h3>
                      <p className="text-stone-500 text-xs mt-0.5">
                        Export directly from Meta Ads Manager or use the Jaikrishna template.
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white font-semibold rounded-xl text-xs cursor-pointer hover:bg-stone-800 transition-colors shadow-xs">
                      <span>Select Spreadsheet File</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: COLUMN MAPPING */}
              {step === 'mapping' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center justify-between">
                    <span>
                      Detected <strong>{rawHeaders.length} columns</strong> and <strong>{rawDataRows.length} data rows</strong>. Review or adjust column mappings below:
                    </span>
                    <button
                      onClick={() => setStep('preview')}
                      className="px-3 py-1 font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-2xs flex items-center gap-1"
                    >
                      <span>Preview Rows</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto p-2 border border-stone-200 rounded-xl bg-stone-50">
                    {[
                      { key: 'name', label: 'Ad / Campaign Name', required: true },
                      { key: 'totalSpent', label: 'Total Spent (INR)', required: true },
                      { key: 'startDate', label: 'Start Date (DD/MM/YYYY)', required: true },
                      { key: 'endDate', label: 'End Date (DD/MM/YYYY)', required: true },
                      { key: 'conversations', label: 'Messaging Conversations Started' },
                      { key: 'views', label: 'Views (Impressions)' },
                      { key: 'viewers', label: 'Viewers (Reach)' },
                      { key: 'linkClicks', label: 'Link Clicks' },
                      { key: 'engagements', label: 'Post Engagements' },
                      { key: 'reactions', label: 'Post Reactions' },
                      { key: 'comments', label: 'Post Comments' },
                      { key: 'shares', label: 'Post Shares' },
                      { key: 'dailyBudget', label: 'Daily Budget (INR)' },
                      { key: 'occasion', label: 'Occasion / Festival' },
                      { key: 'goal', label: 'Goal / Objective' },
                      { key: 'lessons', label: 'Lessons Learned / Notes' },
                      { key: 'rating', label: 'Rating (1-5)' },
                    ].map((field) => (
                      <div key={field.key} className="p-2.5 bg-white border border-stone-200 rounded-lg">
                        <label className="block font-semibold text-stone-800 mb-1">
                          {field.label} {field.required && <span className="text-rose-600">*</span>}
                        </label>
                        <select
                          value={columnMap[field.key] ?? -1}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setColumnMap({ ...columnMap, [field.key]: val });
                          }}
                          className="w-full px-2 py-1 text-xs border border-stone-300 rounded font-medium"
                        >
                          <option value={-1}>-- Not mapped (Store as null / default) --</option>
                          {rawHeaders.map((h, idx) => (
                            <option key={idx} value={idx}>
                              Column {idx + 1}: &quot;{h}&quot;
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: PREVIEW & ROW-BY-ROW VALIDATION */}
              {step === 'preview' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 font-bold rounded-lg font-mono">
                        {validRowsCount} Valid Rows
                      </span>
                      {errorRowsCount > 0 && (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-900 font-bold rounded-lg font-mono">
                          {errorRowsCount} Error Rows
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-stone-600">Duplicate Handling:</span>
                      <select
                        value={duplicateResolution}
                        onChange={(e: any) => setDuplicateResolution(e.target.value)}
                        className="px-2.5 py-1 border border-stone-300 rounded-lg text-xs font-semibold"
                      >
                        <option value="import_anyway">Import anyway</option>
                        <option value="skip">Skip duplicates</option>
                      </select>
                    </div>
                  </div>

                  {/* Preview Grid */}
                  <div className="max-h-80 overflow-y-auto border border-stone-200 rounded-xl divide-y divide-stone-100">
                    {parsedRows.map((row) => (
                      <div
                        key={row.rowNum}
                        className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          !row.isValid ? 'bg-rose-50/50' : row.isDuplicate ? 'bg-amber-50/40' : 'hover:bg-stone-50'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-stone-900 flex items-center gap-2">
                            <span className="font-mono text-stone-400">Row {row.rowNum}:</span>
                            <span>{row.adName || '<Missing Name>'}</span>
                            {row.isDuplicate && (
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-medium">
                                Duplicate Detected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                            Spend: {formatINR(row.totalSpent)} · Dates: {row.startDate.slice(0, 10)} to {row.endDate.slice(0, 10)} ({row.durationDays}d) · Convs: {row.conversations ?? '—'} · Views: {row.views ?? '—'}
                          </div>

                          {row.errors.length > 0 && (
                            <div className="text-rose-700 font-semibold text-[11px] mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{row.errors.join('; ')}</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {row.isValid ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Ready
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[10px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              Will Skip
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: IMPORTING PROGRESS */}
              {step === 'importing' && (
                <div className="p-10 text-center space-y-4">
                  {isProcessing ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto animate-spin">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm font-display">
                        Importing and creating Fulfilled ads...
                      </h3>
                      <p className="text-xs text-stone-500">
                        Writing batched Firestore documents and recording activity log audit entries.
                      </p>
                    </>
                  ) : importResult ? (
                    <>
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-bold text-stone-900 text-sm font-display">
                        Successfully imported {importResult.count} past Meta ad(s)!
                      </h3>
                      <p className="text-xs text-stone-500 font-mono">
                        Batch ID: <strong>{importResult.batchId}</strong>
                      </p>
                      <button
                        onClick={onClose}
                        className="px-4 py-2 font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors shadow-2xs"
                      >
                        Done &amp; View Hub
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'import' && step !== 'importing' && (
          <div className="px-6 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs">
            <div>
              {step === 'mapping' && (
                <button
                  onClick={() => setStep('upload')}
                  className="px-3.5 py-1.5 font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Choose Another File</span>
                </button>
              )}
              {step === 'preview' && (
                <button
                  onClick={() => setStep('mapping')}
                  className="px-3.5 py-1.5 font-semibold text-stone-700 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Column Mapping</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              {step === 'mapping' && (
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-2xs"
                >
                  Review Preview
                </button>
              )}
              {step === 'preview' && (
                <button
                  onClick={handleExecuteImport}
                  disabled={validRowsCount === 0 || isProcessing}
                  className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Execute Import ({validRowsCount} ads)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
