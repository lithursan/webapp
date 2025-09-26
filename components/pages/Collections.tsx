import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { supabase } from '../../supabaseClient';

const formatCurrency = (amount: number, currency: string = 'LKR') => {
  return `${currency} ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

interface CollectionRecord {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  collectionType: 'credit' | 'cheque';
  amount: number;
  collectedBy: string;
  collectedAt: string;
  status: 'pending' | 'complete';
  notes?: string;
}

export const Collections: React.FC = () => {
  const { orders, customers, users, refetchData } = useData();
  const { currentUser } = useAuth();
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'complete'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit' | 'cheque'>('all');
  const [selectedCollection, setSelectedCollection] = useState<CollectionRecord | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  
  // Refresh data when component mounts
  React.useEffect(() => {
    refetchData();
  }, [refetchData]);

  const isAdminManager = useMemo(() => 
    currentUser?.role === UserRole.Admin || currentUser?.role === UserRole.Manager,
    [currentUser]
  );

  // Generate collection records from orders with outstanding amounts
  useEffect(() => {
    const records: CollectionRecord[] = [];
    
    // Get completed collections from localStorage to prevent re-showing them
    const completedCollections = JSON.parse(localStorage.getItem('completedCollections') || '[]');
    const completedIds = new Set(completedCollections.map((c: any) => c.id));
    
    console.log('Debug - Orders:', orders.length);
    console.log('Debug - Customers:', customers.length);
    console.log('Debug - Users:', users.length);
    console.log('Debug - Completed Collections:', completedIds);
    
    orders.forEach(order => {
      const customer = customers.find(c => c.id === order.customerId);
      const collectedBy = users.find(u => u.id === order.assignedUserId) || 
                          users.find(u => u.email === currentUser?.email); // Fallback to current user
      
      console.log(`Debug - Order ${order.id}:`, {
        creditBalance: order.creditBalance,
        chequeBalance: order.chequeBalance,
        customer: customer?.name,
        collectedBy: collectedBy?.name
      });
      
      if (!customer) {
        console.log(`Debug - No customer found for order ${order.id}, customerId: ${order.customerId}`);
        return;
      }
      
      if (!collectedBy) {
        console.log(`Debug - No user found for order ${order.id}, assignedUserId: ${order.assignedUserId}`);
        return;
      }
      
      // Check if collection was already completed by looking at order notes
      const isCollectionCompleted = order.notes && order.notes.includes('COLLECTION_COMPLETED');
      
      // Credit collections - show any credit balance > 0
      if (order.creditBalance && order.creditBalance > 0) {
        const collectionId = `${order.id}-credit`;
        const isCompleted = completedIds.has(collectionId) || isCollectionCompleted;
        
        records.push({
          id: collectionId,
          orderId: order.id,
          customerId: order.customerId,
          customerName: order.customerName || customer.name,
          collectionType: 'credit',
          amount: order.creditBalance,
          collectedBy: collectedBy.name,
          collectedAt: order.date || new Date().toISOString().slice(0, 10),
          status: isCompleted ? 'complete' : 'pending',
          notes: isCompleted ? 'Previously completed' : ''
        });
      }
      
      // Cheque collections - show any cheque balance > 0
      if (order.chequeBalance && order.chequeBalance > 0) {
        const collectionId = `${order.id}-cheque`;
        const isCompleted = completedIds.has(collectionId) || isCollectionCompleted;
        
        records.push({
          id: collectionId,
          orderId: order.id,
          customerId: order.customerId,
          customerName: order.customerName || customer.name,
          collectionType: 'cheque',
          amount: order.chequeBalance,
          collectedBy: collectedBy.name,
          collectedAt: order.date || new Date().toISOString().slice(0, 10),
          status: isCompleted ? 'complete' : 'pending',
          notes: isCompleted ? 'Previously completed' : ''
        });
      }
      
      // Log collection details for debugging
      if (order.creditBalance > 0 || order.chequeBalance > 0) {
        console.log(`Debug - Order ${order.id} has collections:`, {
          total: order.total,
          creditBalance: order.creditBalance,
          chequeBalance: order.chequeBalance,
          customerName: order.customerName,
          status: order.status
        });
      }
    });
    
    console.log('Debug - Generated collection records:', records.length);
    setCollections(records);
  }, [orders, customers, users, currentUser]);

  const filteredCollections = useMemo(() => {
    let filtered = collections;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.collectionType === typeFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
  }, [collections, statusFilter, typeFilter]);

  const totalStats = useMemo(() => {
    const pending = filteredCollections.filter(c => c.status === 'pending');
    const completed = filteredCollections.filter(c => c.status === 'complete');
    
    return {
      totalPendingAmount: pending.reduce((sum, c) => sum + c.amount, 0),
      totalCompletedAmount: completed.reduce((sum, c) => sum + c.amount, 0),
      pendingCredit: pending.filter(c => c.collectionType === 'credit').reduce((sum, c) => sum + c.amount, 0),
      pendingCheque: pending.filter(c => c.collectionType === 'cheque').reduce((sum, c) => sum + c.amount, 0),
      totalCollections: filteredCollections.length
    };
  }, [filteredCollections]);

  const handleRecognizeCollection = async () => {
    if (!selectedCollection) return;
    
    try {
      // Reduce the outstanding amount from the order
      const updatedOrderData: any = {
        notes: `${selectedCollection.collectionType.toUpperCase()} collection of ${formatCurrency(selectedCollection.amount)} completed by ${currentUser?.name}. ${verificationNotes ? 'Notes: ' + verificationNotes : ''}`
      };
      
      // Reduce the appropriate balance to 0 since it's been collected
      if (selectedCollection.collectionType === 'credit') {
        updatedOrderData.creditbalance = 0;
      } else if (selectedCollection.collectionType === 'cheque') {
        updatedOrderData.chequebalance = 0;
      }
      
      // Update order in database
      const { error: orderError } = await supabase
        .from('orders')
        .update(updatedOrderData)
        .eq('id', selectedCollection.orderId);
      
      if (orderError) throw orderError;
      
      // Update customer outstanding balance in database
      const customer = customers.find(c => c.id === selectedCollection.customerId);
      if (customer) {
        const newOutstandingBalance = Math.max(0, (customer.outstandingBalance || 0) - selectedCollection.amount);
        await supabase
          .from('customers')
          .update({ outstandingbalance: newOutstandingBalance })
          .eq('id', selectedCollection.customerId);
      }
      
      // Store completion status in localStorage
      const completedCollections = JSON.parse(localStorage.getItem('completedCollections') || '[]');
      if (!completedCollections.includes(selectedCollection.id)) {
        completedCollections.push(selectedCollection.id);
        localStorage.setItem('completedCollections', JSON.stringify(completedCollections));
      }

      // Update local state immediately for real-time UI update
      setCollections(prev => 
        prev.map(c => 
          c.id === selectedCollection.id 
            ? { ...c, status: 'complete' as const, notes: verificationNotes }
            : c
        )
      );
      
      // Refresh all data from server to ensure consistency
      await refetchData();
      
      alert(`${selectedCollection.collectionType.toUpperCase()} collection of ${formatCurrency(selectedCollection.amount)} has been completed and all outstanding amounts updated!`);
      
      setSelectedCollection(null);
      setVerificationNotes('');
    } catch (error) {
      console.error('Error recognizing collection:', error);
      alert('Failed to recognize collection. Please try again.');
    }
  };

  if (!isAdminManager) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">Access Denied</h1>
        <p className="text-slate-600 dark:text-slate-400">Only Admin and Manager roles can access the Collection Management page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Collection Management</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <span className="text-2xl">⏳</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Collections</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalStats.totalPendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Completed Collections</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.totalCompletedAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Credit</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalStats.pendingCredit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <span className="text-2xl">🏦</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Cheques</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(totalStats.pendingCheque)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Records</CardTitle>
          <CardDescription>
            Review and verify all outstanding collections from field staff
          </CardDescription>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'complete')}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending Verification</option>
              <option value="complete">Complete</option>
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'credit' | 'cheque')}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="credit">Credit Collections</option>
              <option value="cheque">Cheque Collections</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
              <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-6 py-3">Order ID</th>
                  <th scope="col" className="px-6 py-3">Customer</th>
                  <th scope="col" className="px-6 py-3">Type</th>
                  <th scope="col" className="px-6 py-3">Amount</th>
                  <th scope="col" className="px-6 py-3">Collected By</th>
                  <th scope="col" className="px-6 py-3">Date</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCollections.map((collection) => (
                  <tr key={collection.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {collection.orderId}
                    </td>
                    <td className="px-6 py-4">{collection.customerName}</td>
                    <td className="px-6 py-4">
                      <Badge variant={collection.collectionType === 'credit' ? 'info' : 'warning'}>
                        {collection.collectionType === 'credit' ? '💰 Credit' : '🏦 Cheque'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-bold text-green-600">
                      {formatCurrency(collection.amount)}
                    </td>
                    <td className="px-6 py-4">{collection.collectedBy}</td>
                    <td className="px-6 py-4">
                      {new Date(collection.collectedAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={collection.status === 'pending' ? 'warning' : 'success'}>
                        {collection.status === 'pending' ? '⏳ Pending' : '✅ Complete'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {collection.status === 'pending' ? (
                        <button
                          onClick={() => setSelectedCollection(collection)}
                          className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Verify & Recognize
                        </button>
                      ) : (
                        <span className="text-sm text-slate-400">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredCollections.length === 0 && (
              <div className="text-center py-10">
                <p className="text-slate-500 dark:text-slate-400">No collections found matching your criteria.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recognition Modal */}
      <Modal
        isOpen={!!selectedCollection}
        onClose={() => {
          setSelectedCollection(null);
          setVerificationNotes('');
        }}
        title="Verify Collection"
      >
        {selectedCollection && (
          <div className="p-6 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Collection Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Order ID:</span>
                  <p className="font-medium">{selectedCollection.orderId}</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Customer:</span>
                  <p className="font-medium">{selectedCollection.customerName}</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Type:</span>
                  <p className="font-medium capitalize">{selectedCollection.collectionType}</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Amount:</span>
                  <p className="font-bold text-green-600">{formatCurrency(selectedCollection.amount)}</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Collected By:</span>
                  <p className="font-medium">{selectedCollection.collectedBy}</p>
                </div>
                <div>
                  <span className="text-slate-600 dark:text-slate-400">Date:</span>
                  <p className="font-medium">{new Date(selectedCollection.collectedAt).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="verificationNotes" className="block mb-2 text-sm font-medium text-slate-900 dark:text-white">
                Verification Notes (Optional)
              </label>
              <textarea
                id="verificationNotes"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                rows={3}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-slate-700 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white"
                placeholder="Enter any verification notes or comments..."
              />
            </div>
            
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-600">
              <button
                onClick={() => {
                  setSelectedCollection(null);
                  setVerificationNotes('');
                }}
                type="button"
                className="text-slate-500 bg-white hover:bg-slate-100 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg border border-slate-200 text-sm font-medium px-5 py-2.5 hover:text-slate-900 focus:z-10 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-500 dark:hover:text-white dark:hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRecognizeCollection}
                type="button"
                className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-green-600 dark:hover:bg-green-700"
              >
                ✅ Recognize Collection
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};