import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}
import { 
  Sparkles, 
  Lock, 
  Check, 
  CreditCard,
  Building,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { api } from '../services/api';

interface SubscriptionModalProps {
  onSuccess: () => void;
  companyName: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  months: number;
  price: number;
  hasGst?: boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onSuccess, companyName }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setPlansLoading(true);
        const res = await api.get('/company/plans');
        if (res.data?.success && res.data?.data) {
          const fetchedPlans = res.data.data;
          setPlans(fetchedPlans);
          if (fetchedPlans.length > 0) {
            setSelectedPlanId(fetchedPlans[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load active plans:', err);
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!selectedPlanId) {
      setError('Please select a pricing plan to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 1. Create order on backend
      const orderRes = await api.post('/company/create-subscription-order', { planId: selectedPlanId });
      if (!orderRes.data?.success) {
        throw new Error('Failed to initialize payment.');
      }

      const { orderId, amount, currency, planId, keyId } = orderRes.data.data;

      // 2. Load script
      const res = await loadRazorpayScript();
      if (!res) {
        throw new Error('Razorpay SDK failed to load. Are you online?');
      }

      // 3. Initialize Razorpay
      const options = {
        key: keyId, // Enter the Key ID generated from the Dashboard
        amount: amount.toString(),
        currency: currency,
        name: 'KaryaNiyantrak SaaS',
        description: 'Professional Workspace Subscription',
        order_id: orderId,
        handler: async function (response: any) {
          try {
            setLoading(true);
            // 4. Verify payment on backend
            const verifyRes = await api.post('/company/subscribe', {
              planId: planId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });

            if (verifyRes.data?.success) {
              setSuccess(true);
              setTimeout(() => {
                onSuccess();
              }, 2000);
            }
          } catch (err: any) {
            setError(err.response?.data?.message || 'Payment verification failed.');
            setLoading(false);
          }
        },
        prefill: {
          name: companyName,
        },
        theme: {
          color: '#6366f1',
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        setError(response.error.description || 'Payment failed.');
        setLoading(false);
      });
      
      paymentObject.open();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Payment processing failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-8 text-center relative overflow-hidden flex flex-col justify-between my-8">
        
        {/* Animated Background Highlights */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />

        {!success ? (
          <>
            {/* Top Badge */}
            <div className="flex justify-center mb-6">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                Subscription Required
              </span>
            </div>

            {/* Lock Header */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 shadow-inner">
              <Lock className="w-7 h-7 text-indigo-400" />
            </div>

            {/* Message Details */}
            <div className="space-y-2 mb-6">
              <h2 className="text-xl font-extrabold text-white">Unlock Workspace Access</h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                The trial period or paid subscription for <strong className="text-slate-200">{companyName}</strong> has expired. 
                Renew now to restore full access to claims, salaries, ledger entries, and directories.
              </p>
            </div>

            {/* Premium Plan Features List */}
            <div className="bg-slate-950/50 border border-slate-800/60 rounded-2xl p-5 mb-6 text-left space-y-3.5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">KaryaNiyantrak Professional Suite Includes:</h4>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  'Unified Ledger Ledger (Unlimited Transactions)',
                  'Active Staff Directory & Leave Approval Chains',
                  'One-click Payroll Processing & Pay-slip Generation',
                  'Expense Claims Management & Reimbursement tracking',
                  'Auditing & Security Log Dashboards'
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Subscription Plan Selector */}
            <div className="mb-6 text-left">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">Select Subscription Package *</label>
              {plansLoading ? (
                <div className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-400 text-xs font-semibold animate-pulse text-center">
                  Loading available pricing plans...
                </div>
              ) : plans.length === 0 ? (
                <div className="w-full bg-red-950/20 border border-red-900/50 rounded-xl px-4 py-3.5 text-red-400 text-xs font-semibold text-center">
                  No pricing plans available. Contact master admin to seed pricing.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`cursor-pointer flex items-center justify-between bg-slate-950/60 border rounded-2xl px-5 py-4 transition-all hover:bg-slate-950 ${
                        selectedPlanId === plan.id 
                          ? 'border-indigo-500 shadow-md shadow-indigo-500/10' 
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedPlanId === plan.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-700 bg-transparent'
                        }`}>
                          {selectedPlanId === plan.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">{plan.name}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{plan.months} {plan.months === 1 ? 'Month' : 'Months'} Duration</span>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-sm font-extrabold text-indigo-400">₹{plan.price.toLocaleString('en-IN')}</span>
                        {plan.hasGst && <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">+ 18% GST</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3.5 bg-red-950/40 border border-red-900/50 text-red-300 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Real Payment Action Button */}
            <button
              onClick={handlePayment}
              disabled={loading || plans.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white py-3.5 px-6 rounded-xl text-xs font-bold transition-all shadow-lg hover:shadow-indigo-500/10 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay with Razorpay & Unlock Now</span>
                </>
              )}
            </button>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5 animate-bounce">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-xl font-extrabold text-white">Payment Successful</h3>
            <p className="text-xs text-slate-400 font-medium max-w-sm">
              Your professional plan has been activated. Restoring access and refreshing workspace dashboard parameters...
            </p>
          </div>
        )}

      </div>
    </div>
  );
};
