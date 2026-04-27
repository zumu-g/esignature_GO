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
  const [loading, setLoading] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const { user, updateCredits } = useAuthStore();

  useEffect(() => {
    Promise.all([
      api.getCredits().then((data) => setPacks(data.packs)),
      api.getCreditHistory().then(setHistory),
    ]).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load credits');
    }).finally(() => {
      setLoadingData(false);
    });
  }, []);

  const handlePurchase = async (packId: string) => {
    setLoading(packId);
    setError('');
    try {
      const result = await api.purchaseCredits(packId);
      updateCredits(result.credits);
      await useAuthStore.getState().loadUser();
      const [updatedPacks, updatedHistory] = await Promise.all([
        api.getCredits(),
        api.getCreditHistory(),
      ]);
      setPacks(updatedPacks.packs);
      setHistory(updatedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setLoading(null);
    }
  };

  // Determine the "popular" pack — middle pack or highest credit count
  const popularPackId = packs.length >= 2 ? packs[Math.floor(packs.length / 2)]?.id : undefined;

  return (
    <PageEntrance className="max-w-5xl mx-auto py-12 px-4">

      {/* Page header */}
      <div className="mb-10">
        <h1 style={{ fontSize: 32, fontWeight: 600, color: '#1D1D1F', lineHeight: 1.1, marginBottom: 8 }}>
          Buy Credits
        </h1>
        <p style={{ fontSize: 17, color: '#6E6E73' }}>
          Each credit sends one document — unlimited pages and recipients.
        </p>
      </div>

      {/* Credit balance banner */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E8ED',
          borderRadius: 18,
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          padding: '28px 32px',
          marginBottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CreditCard style={{ width: 18, height: 18, color: '#0071E3' }} />
            <span style={{ fontSize: 14, color: '#6E6E73', fontWeight: 500 }}>Current Balance</span>
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#1D1D1F', lineHeight: 1, marginBottom: 6 }}>
            {user?.credits ?? 0}
            <span style={{ fontSize: 20, fontWeight: 500, color: '#6E6E73', marginLeft: 10 }}>credits</span>
          </div>
          <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 4 }}>
            1 credit = 1 document send (unlimited pages &amp; recipients)
          </p>
        </div>
        <CreditCoinIllustration size={80} className="flex-shrink-0" />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: '#FFF2ED',
            color: '#B64400',
            fontSize: 14,
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #FFDDC8',
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {/* Section heading */}
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', marginBottom: 20 }}>
        Credit Packs
      </h2>

      {/* Packs grid */}
      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div
            className="animate-spin"
            style={{
              width: 28,
              height: 28,
              border: '3px solid #E8E8ED',
              borderTopColor: '#0071E3',
              borderRadius: '50%',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ fontSize: 14, color: '#6E6E73' }}>Loading credit packs...</p>
        </div>
      ) : (
        <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {packs.map((pack) => {
            const pricePerCredit = (pack.price / 100 / pack.credits).toFixed(2);
            const isPopular = pack.id === popularPackId;

            return (
              <StaggerItem key={pack.id}>
                <MotionCard
                  style={{
                    background: '#FFFFFF',
                    border: isPopular ? '1px solid #0071E3' : '1px solid #E8E8ED',
                    borderRadius: 18,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s ease-out, transform 0.2s ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  className="hover-card"
                >
                  {/* Popular badge band */}
                  {isPopular && (
                    <div
                      style={{
                        background: '#0071E3',
                        padding: '8px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        Most Popular
                      </span>
                      <span
                        style={{
                          background: '#FF791B',
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          letterSpacing: '0.03em',
                        }}
                      >
                        BEST VALUE
                      </span>
                    </div>
                  )}

                  <div style={{ padding: '24px 24px 28px' }}>
                    {/* Pack name */}
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#6E6E73', marginBottom: 4 }}>
                      {pack.credits >= 50 ? 'Pro Pack' : pack.credits >= 20 ? 'Starter Pack' : 'Micro Pack'}
                    </div>

                    {/* Credit count — large, blue */}
                    <div style={{ fontSize: 42, fontWeight: 700, color: '#0071E3', lineHeight: 1, marginBottom: 4 }}>
                      {pack.credits}
                      <span style={{ fontSize: 18, fontWeight: 500, color: '#6E6E73', marginLeft: 6 }}>credits</span>
                    </div>

                    {/* Price */}
                    <div style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', marginBottom: 4 }}>
                      ${(pack.price / 100).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 13, color: '#6E6E73', marginBottom: 20 }}>
                      ${pricePerCredit} per credit
                    </div>

                    {/* Feature list */}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        `${pack.credits} document sends`,
                        'Unlimited pages per doc',
                        'Unlimited signers',
                        'Audit trail included',
                      ].map((feature) => (
                        <li key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1D1D1F' }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#0071E3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* CTA button */}
                    <MotionButton
                      onClick={() => handlePurchase(pack.id)}
                      disabled={!!loading}
                      style={{
                        width: '100%',
                        background: isPopular ? '#0071E3' : '#F5F5F7',
                        color: isPopular ? '#FFFFFF' : '#1D1D1F',
                        border: isPopular ? 'none' : '1px solid #E8E8ED',
                        borderRadius: 8,
                        height: 44,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading && loading !== pack.id ? 0.5 : 1,
                        transition: 'background 0.15s ease-in-out',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                        if (!loading) {
                          (e.currentTarget as HTMLButtonElement).style.background = isPopular ? '#0066CC' : '#EBEBED';
                        }
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                        (e.currentTarget as HTMLButtonElement).style.background = isPopular ? '#0071E3' : '#F5F5F7';
                      }}
                    >
                      {loading === pack.id ? 'Processing...' : 'Purchase'}
                    </MotionButton>
                  </div>
                </MotionCard>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}

      {/* Transaction History */}
      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1D1D1F', marginBottom: 16 }}>
        Transaction History
      </h2>

      {history.length === 0 ? (
        <p style={{ fontSize: 14, color: '#6E6E73' }}>No transactions yet.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div
            className="hidden md:block"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8E8ED',
              borderRadius: 18,
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F5F7', borderBottom: '1px solid #E8E8ED' }}>
                  {['Type', 'Description', 'Credits', 'Date'].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        textAlign: i >= 2 ? 'right' : 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6E6E73',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '12px 20px',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((tx, index) => (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    style={{ borderBottom: '1px solid #E8E8ED' }}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {tx.amount > 0 ? (
                          <ArrowUpRight style={{ width: 16, height: 16, color: '#34C759' }} />
                        ) : (
                          <ArrowDownRight style={{ width: 16, height: 16, color: '#B64400' }} />
                        )}
                        <span style={{ fontSize: 14, color: '#1D1D1F', textTransform: 'capitalize' }}>{tx.transactionType}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: '#6E6E73' }}>{tx.description || '—'}</td>
                    <td
                      style={{
                        padding: '14px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: 'right',
                        color: tx.amount > 0 ? '#34C759' : '#B64400',
                      }}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 14, color: '#6E6E73', textAlign: 'right' }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((tx, index) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E8E8ED',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tx.amount > 0 ? (
                      <ArrowUpRight style={{ width: 16, height: 16, color: '#34C759' }} />
                    ) : (
                      <ArrowDownRight style={{ width: 16, height: 16, color: '#B64400' }} />
                    )}
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F', textTransform: 'capitalize' }}>{tx.transactionType}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: tx.amount > 0 ? '#34C759' : '#B64400' }}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: '#6E6E73' }}>{tx.description || '—'}</span>
                  <span style={{ fontSize: 12, color: '#6E6E73' }}>{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </PageEntrance>
  );
}
