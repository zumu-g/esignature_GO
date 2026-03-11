import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { CreditPack, CreditTransaction } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { PageEntrance, MotionButton, MotionCard, StaggerList, StaggerItem, FadeIn, motion } from '../components/Motion';
import { CreditCoinIllustration } from '../components/Illustrations';

export default function Credits() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [history, setHistory] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, updateCredits } = useAuthStore();

  useEffect(() => {
    api.getCredits().then((data) => setPacks(data.packs));
    api.getCreditHistory().then(setHistory);
  }, []);

  const handlePurchase = async (packId: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.purchaseCredits(packId);
      updateCredits(result.credits);
      const updatedHistory = await api.getCreditHistory();
      setHistory(updatedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageEntrance className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Credits</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <span className="text-sm text-gray-500">Current Balance</span>
            </div>
            <div className="text-4xl font-bold text-gray-900">{user?.credits ?? 0} credits</div>
            <p className="text-sm text-gray-500 mt-1">1 credit = 1 document send (unlimited pages & recipients)</p>
          </div>
          <CreditCoinIllustration size={80} className="flex-shrink-0" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md mb-4">{error}</div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Buy Credits</h2>
      <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {packs.map((pack) => {
          const pricePerCredit = (pack.price / 100 / pack.credits).toFixed(2);
          return (
            <StaggerItem key={pack.id}>
              <MotionCard className="bg-white rounded-lg border border-gray-200 p-5 hover:border-blue-300 transition-all duration-200">
                <div className="text-lg font-bold text-gray-900">{pack.credits} Credits</div>
                <div className="text-2xl font-bold text-blue-600 my-2">${(pack.price / 100).toFixed(2)}</div>
                <div className="text-xs text-gray-500 mb-4">${pricePerCredit} per credit</div>
                <MotionButton
                  onClick={() => handlePurchase(pack.id)}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors duration-150"
                >
                  {loading ? 'Processing...' : 'Purchase'}
                </MotionButton>
              </MotionCard>
            </StaggerItem>
          );
        })}
      </StaggerList>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Credits</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((tx, index) => (
                <motion.tr key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {tx.amount > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm capitalize">{tx.transactionType}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tx.description || '-'}</td>
                  <td className={`px-4 py-3 text-sm text-right font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageEntrance>
  );
}
