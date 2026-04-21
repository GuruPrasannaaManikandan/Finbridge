import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLoans } from '@/hooks/useLoans';
import { useProfile } from '@/hooks/useProfile';
import { calculateEMI, calculateDebtToIncome, getRiskLevel, getPersonalizedTips } from '@/lib/financial';
import { useToast } from '@/hooks/use-toast';
import { useVoice } from '@/hooks/useVoice';
import { getFinancialAdvice } from '@/lib/interpreter';
import { Language } from '@/lib/languages';
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface LoanCheckerProps {
  currentLanguage: Language;
}

export function LoanChecker({ currentLanguage }: LoanCheckerProps) {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('10');
  const [tenure, setTenure] = useState('60');
  const [result, setResult] = useState<{
    emi: number;
    dti: number;
    risk: ReturnType<typeof getRiskLevel>;
    tips: string[];
    warning: string | null;
  } | null>(null);

  const { addLoan } = useLoans();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { speak } = useVoice(currentLanguage);

  const handleCheck = () => {
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const n = parseInt(tenure);
    if (!p || !r || !n) return;

    const emi = calculateEMI(p, r, n);
    const monthlyIncome = Number(profile?.monthly_income) || 50000;
    const dti = calculateDebtToIncome(emi, monthlyIncome);
    const risk = getRiskLevel(dti);
    const annualIncome = monthlyIncome * 12;
    const warning = p > annualIncome * 5 ? `⚠️ Loan amount exceeds 5x your annual income (₹${annualIncome.toLocaleString()})` : null;
    const tips = getPersonalizedTips(0, dti, 0, profile?.persona || 'salaried');

    setResult({ emi, dti, risk, tips, warning });

    getFinancialAdvice({
      emi: Math.round(emi),
      debtToIncome: dti.toFixed(1),
      risk: risk.label,
      warning
    }, currentLanguage).then(response => {
      speak(response);
    });
  };

  const handleSaveLoan = () => {
    if (!result) return;

    addLoan.mutate({
      loan_amount: parseFloat(principal),
      interest_rate: parseFloat(rate),
      tenure: parseInt(tenure),
      emi: Math.round(result.emi),
      risk_score: result.dti,
      risk_level: result.risk.level,
      debt_to_income: result.dti,
    }, {
      onSuccess: () => toast({ title: 'Loan saved to history' }),
    });
  };

  // ✅ NEW SIMPLE PDF GENERATION + SEND
  const handleSendReport = async () => {
    const element = document.getElementById("loan-report");

    if (!element) {
      toast({ title: "No report available", variant: "destructive" });
      return;
    }

    try {
      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF();
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

      const pdfBlob = pdf.output("blob");

      const formData = new FormData();
      formData.append("file", pdfBlob, "LoanReport.pdf");

      await fetch("http://localhost:5000/send-report", {
        method: "POST",
        body: formData,
      });

      toast({ title: "Report sent successfully 📧" });
    } catch (error) {
      toast({ title: "Failed to send report", variant: "destructive" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-display text-lg">Loan Checker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Amount (₹)</Label>
            <Input type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="500000" />
          </div>
          <div>
            <Label className="text-xs">Rate (%)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Months</Label>
            <Input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} />
          </div>
        </div>

        <Button onClick={handleCheck} className="w-full">
          Check Loan Eligibility
        </Button>

        {result && (
          <div id="loan-report" className="space-y-3 animate-fade-in">

            <div className={`p-4 rounded-lg border ${
              result.risk.level === 'safe'
                ? 'bg-primary/10 border-primary/30'
                : result.risk.level === 'caution'
                ? 'bg-warning/10 border-warning/30'
                : 'bg-destructive/10 border-destructive/30'
            }`}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Monthly EMI</span>
                  <p className="font-display font-bold text-lg">
                    ₹{Math.round(result.emi).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Risk Level</span>
                  <p className="font-display font-bold text-lg">
                    {result.risk.label}
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={handleSaveLoan}
              className="w-full"
              disabled={addLoan.isPending}
            >
              Save to Loan History
            </Button>

            <Button
              onClick={handleSendReport}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Mail Me PDF Report
            </Button>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
