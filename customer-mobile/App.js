import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  appendPublicOrderItems,
  callPublicWaiter,
  fetchPublicBill,
  fetchPublicMenu,
  fetchPublicOrderStatus,
  fetchPublicTable,
  placePublicOrder,
  requestPublicBill,
  submitPublicFeedback,
} from './src/api/publicApi';
import formatCurrency from './src/utils/formatCurrency';

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
];

const CAT_META = {
  appetizer: { icon: '🥗', label: 'Starters' },
  main: { icon: '🍽', label: 'Main' },
  dessert: { icon: '🍰', label: 'Dessert' },
  beverage: { icon: '🥤', label: 'Drinks' },
  special: { icon: '⭐', label: 'Specials' },
};

const TRACK_STEPS = [
  { key: 'pending', label: 'Received', icon: '📋' },
  { key: 'confirmed', label: 'Confirmed', icon: '✅' },
  { key: 'preparing', label: 'Preparing', icon: '👨‍🍳' },
  { key: 'ready', label: 'Ready', icon: '🔔' },
  { key: 'served', label: 'Served', icon: '🍽' },
  { key: 'paid', label: 'Paid', icon: '💳' },
];

const paramsFromEnv = {
  restaurantId: process.env.EXPO_PUBLIC_RESTAURANT_ID || '',
  branchId: process.env.EXPO_PUBLIC_BRANCH_ID || '',
  tableId: process.env.EXPO_PUBLIC_TABLE_ID || '',
};

const imageFor = (item, index = 0) =>
  item?.imageUrl || item?.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];

function Pill({ active, children, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.pill, active && styles.pillActive, disabled && styles.disabled]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{children}</Text>
    </Pressable>
  );
}

function QtyControl({ qty, onAdd, onMinus, onPlus }) {
  if (!qty) {
    return (
      <Pressable onPress={onAdd} style={styles.addCircle}>
        <Text style={styles.addCircleText}>+</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.qtyWrap}>
      <Pressable onPress={onMinus} style={styles.qtyButton}><Text style={styles.qtyText}>-</Text></Pressable>
      <Text style={styles.qtyNumber}>{qty}</Text>
      <Pressable onPress={onPlus} style={styles.qtyButtonDark}><Text style={styles.qtyTextDark}>+</Text></Pressable>
    </View>
  );
}

function SetupScreen({ ids, setIds, onLoad, loading }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerPage}>
        <View style={styles.setupCard}>
          <Text style={styles.brand}>RestroX</Text>
          <Text style={styles.title}>Customer table</Text>
          <Text style={styles.muted}>Enter QR table IDs to open the customer menu.</Text>
          {['restaurantId', 'branchId', 'tableId'].map((key) => (
            <TextInput
              key={key}
              value={ids[key]}
              onChangeText={(value) => setIds((prev) => ({ ...prev, [key]: value.trim() }))}
              placeholder={key}
              autoCapitalize="none"
              style={styles.input}
            />
          ))}
          <Pressable onPress={onLoad} disabled={loading} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{loading ? 'Opening...' : 'Open menu'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MenuScreen({
  tableInfo,
  menu,
  cart,
  activeCategory,
  setActiveCategory,
  selectedItem,
  setSelectedItem,
  addToCart,
  changeQty,
}) {
  const categories = Object.keys(menu.grouped || {});
  const source = menu.grouped?.[activeCategory] || menu.items || [];
  const featured = selectedItem || source[0] || menu.items?.[0];
  const supporting = source.filter((item) => item._id !== featured?._id);
  const recommended = (supporting.length ? supporting : menu.items.filter((item) => item._id !== featured?._id)).slice(0, 3);
  const cartQty = (id) => cart.find((item) => item._id === id)?.qty || 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.mobileUserCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(tableInfo?.restaurant?.name || 'G')[0]}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{tableInfo?.restaurant?.name || 'Restaurant'}</Text>
          <Text style={styles.mutedSmall}>{tableInfo?.branch?.name || 'Branch'} · Table {tableInfo?.table?.number || '-'}</Text>
        </View>
      </View>

      <Text style={styles.eyebrow}>Meal category</Text>
      <Text style={styles.title}>{CAT_META[activeCategory]?.label || 'Menu'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        {categories.map((cat) => (
          <Pill
            key={cat}
            active={cat === activeCategory}
            onPress={() => {
              setActiveCategory(cat);
              setSelectedItem(null);
            }}
          >
            {(CAT_META[cat]?.icon || '🍴') + ' ' + (CAT_META[cat]?.label || cat)}
          </Pill>
        ))}
      </ScrollView>

      {featured && (
        <View style={styles.heroCard}>
          <View style={styles.heroImageBox}>
            <Image source={{ uri: imageFor(featured) }} style={styles.heroImage} />
          </View>
          <Text style={styles.eyebrow}>{featured.category || 'Featured'}</Text>
          <Text style={styles.heroTitle}>{featured.name}</Text>
          <Text style={styles.heroDescription}>{featured.description || 'Freshly prepared by the kitchen.'}</Text>
          <View style={styles.heroActions}>
            <Text style={styles.price}>{formatCurrency(featured.price)}</Text>
            <Pressable onPress={() => addToCart(featured)} style={styles.heroAdd}>
              <Text style={styles.heroAddText}>Add to order</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recommended</Text>
        <Text style={styles.mutedSmall}>{recommended.length} items</Text>
      </View>
      {recommended.map((item, index) => (
        <DishRow
          key={item._id}
          item={item}
          index={index}
          qty={cartQty(item._id)}
          onSelect={() => setSelectedItem(item)}
          onAdd={() => addToCart(item)}
          onMinus={() => changeQty(item._id, cartQty(item._id) - 1)}
          onPlus={() => changeQty(item._id, cartQty(item._id) + 1)}
        />
      ))}

      <Text style={[styles.sectionTitle, styles.moreTitle]}>More dishes</Text>
      {supporting.map((item, index) => (
        <DishRow
          key={item._id}
          item={item}
          index={index + 3}
          qty={cartQty(item._id)}
          onSelect={() => setSelectedItem(item)}
          onAdd={() => addToCart(item)}
          onMinus={() => changeQty(item._id, cartQty(item._id) - 1)}
          onPlus={() => changeQty(item._id, cartQty(item._id) + 1)}
        />
      ))}
    </ScrollView>
  );
}

function DishRow({ item, index, qty, onSelect, onAdd, onMinus, onPlus }) {
  return (
    <Pressable onPress={onSelect} style={styles.dishRow}>
      <Image source={{ uri: imageFor(item, index) }} style={styles.dishImage} />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.dishName}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.dishDescription}>{item.description || item.category}</Text>
        <Text style={styles.dishPrice}>{formatCurrency(item.price)}</Text>
      </View>
      <QtyControl qty={qty} onAdd={onAdd} onMinus={onMinus} onPlus={onPlus} />
    </Pressable>
  );
}

function OrderScreen({
  cart,
  changeQty,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerNote,
  setCustomerNote,
  submitting,
  submitOrder,
  currentOrderId,
  goTrack,
  isAppendMode,
}) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>My order</Text>
          <Text style={styles.mutedSmall}>{cart.length} positions</Text>
        </View>
        {cart.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.muted}>Add dishes to start your order.</Text></View>
        ) : cart.map((item) => (
          <View key={item._id} style={styles.cartRow}>
            <Image source={{ uri: item.imageUrl }} style={styles.cartImage} />
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.dishName}>{item.name}</Text>
              <Text style={styles.dishPrice}>{formatCurrency(item.price * item.qty)}</Text>
            </View>
            <QtyControl
              qty={item.qty}
              onAdd={() => changeQty(item._id, item.qty + 1)}
              onMinus={() => changeQty(item._id, item.qty - 1)}
              onPlus={() => changeQty(item._id, item.qty + 1)}
            />
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your details</Text>
        {isAppendMode && <Text style={styles.notice}>Adding items to your current order.</Text>}
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Name optional" style={styles.input} />
        <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone optional" keyboardType="phone-pad" style={styles.input} />
        <TextInput
          value={customerNote}
          onChangeText={setCustomerNote}
          placeholder="Table note optional"
          multiline
          style={[styles.input, styles.textArea]}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalLabel}>{formatCurrency(subtotal)}</Text></View>
        <View style={styles.rowBetween}><Text style={styles.totalMuted}>Service</Text><Text style={styles.totalMuted}>Calculated at bill</Text></View>
        <View style={styles.rowBetween}><Text style={styles.total}>Total</Text><Text style={styles.total}>{formatCurrency(subtotal)}</Text></View>
        <Pressable disabled={submitting || !cart.length} onPress={submitOrder} style={[styles.primaryButton, (!cart.length || submitting) && styles.disabledButton]}>
          <Text style={styles.primaryButtonText}>{submitting ? 'Confirming...' : isAppendMode ? 'Add Items to Order' : 'Confirm Order'}</Text>
        </Pressable>
        {!!currentOrderId && (
          <Pressable onPress={goTrack} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>Track Current Order</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function TrackScreen({ order, loading, refresh, callWaiter, requestBill, viewBill, submitFeedback, billLoading }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  if (loading) {
    return <View style={styles.centerPage}><ActivityIndicator color="#dc2626" /><Text style={styles.muted}>Loading order...</Text></View>;
  }

  if (!order) {
    return <View style={styles.centerPage}><Text style={styles.title}>No active order yet</Text><Text style={styles.muted}>Confirm an order to start tracking.</Text></View>;
  }

  const activeIndex = TRACK_STEPS.findIndex((step) => step.key === order.status);
  const isClosed = ['paid', 'cancelled'].includes(order.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.trackHero}>
        <View>
          <Text style={styles.trackTable}>Table {order.tableNumber || '-'}</Text>
          <Text style={styles.trackOrder}>{order.orderNumber}</Text>
          <Text style={styles.trackCopy}>{isClosed ? 'Thanks for dining with us.' : 'Track your food while browsing.'}</Text>
        </View>
        <Pressable onPress={refresh} style={styles.refreshButton}><Text style={styles.refreshText}>↻</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order progress</Text>
        {TRACK_STEPS.map((step, index) => {
          const done = activeIndex >= index;
          return (
            <View key={step.key} style={styles.stepRow}>
              <View style={[styles.stepDot, done && styles.stepDotDone]}><Text>{done ? step.icon : '○'}</Text></View>
              <Text style={[styles.stepText, done && styles.stepTextDone]}>{step.label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your items</Text>
        {order.items?.map((item, index) => (
          <View key={`${item.name}-${index}`} style={styles.rowBetween}>
            <Text style={styles.itemLine}>{item.name} x{item.quantity}</Text>
            <Text style={styles.badge}>{item.itemStatus}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.rowBetween}><Text style={styles.total}>Total</Text><Text style={styles.total}>{formatCurrency(order.totalAmount || 0)}</Text></View>
      </View>

      {!isClosed && (
        <View style={styles.actionGrid}>
          <Pressable onPress={callWaiter} style={styles.actionButton}><Text style={styles.actionText}>Call Waiter</Text></Pressable>
          <Pressable disabled={['requested', 'presented'].includes(order.billStatus)} onPress={requestBill} style={styles.actionButton}><Text style={styles.actionText}>Request Bill</Text></Pressable>
          <Pressable onPress={viewBill} disabled={billLoading} style={styles.darkActionButton}><Text style={styles.darkActionText}>{billLoading ? 'Loading...' : 'View Bill'}</Text></Pressable>
        </View>
      )}

      {['served', 'paid'].includes(order.status) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable key={value} onPress={() => setRating(value)}>
                <Text style={[styles.star, value <= rating && styles.starActive]}>★</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={comment} onChangeText={setComment} placeholder="Write a short comment..." multiline style={[styles.input, styles.textArea]} />
          <Pressable onPress={() => submitFeedback({ rating, comment })} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Submit Feedback</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function UserScreen({ tableInfo, customerName, setCustomerName, customerPhone, setCustomerPhone, customerNote, setCustomerNote }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <View style={styles.mobileUserCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(customerName || tableInfo?.restaurant?.name || 'G')[0]}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{customerName || 'Guest customer'}</Text>
            <Text style={styles.mutedSmall}>{tableInfo?.restaurant?.name || 'Restaurant'} · Table {tableInfo?.table?.number || '-'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your details</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Name optional" style={styles.input} />
        <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone optional" keyboardType="phone-pad" style={styles.input} />
        <TextInput value={customerNote} onChangeText={setCustomerNote} placeholder="Table note optional" multiline style={[styles.input, styles.textArea]} />
      </View>
    </ScrollView>
  );
}

function BottomNav({ tab, setTab, currentOrderId, openQr }) {
  const item = (key, label, icon, disabled) => (
    <Pressable key={key} disabled={disabled} onPress={() => setTab(key)} style={styles.navItem}>
      <Text style={[styles.navIcon, tab === key && styles.navActive, disabled && styles.navDisabled]}>{icon}</Text>
      <Text style={[styles.navText, tab === key && styles.navActive, disabled && styles.navDisabled]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.bottomNav}>
      {item('menu', 'Menu', '☰')}
      {item('order', 'Order', '▤')}
      <Pressable onPress={openQr} style={styles.qrButton}><Text style={styles.qrButtonText}>▦</Text></Pressable>
      {item('track', 'Track', '◷', !currentOrderId)}
      {item('user', 'User', '◉')}
    </View>
  );
}

export default function App() {
  const [ids, setIds] = useState(paramsFromEnv);
  const [tableInfo, setTableInfo] = useState(null);
  const [menu, setMenu] = useState({ items: [], grouped: {} });
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [tab, setTab] = useState('menu');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  const canOpen = ids.restaurantId && ids.branchId && ids.tableId;
  const isAppendMode = !!currentOrderId;

  const loadApp = useCallback(async () => {
    if (!canOpen) {
      Alert.alert('Missing QR data', 'Restaurant, branch, and table IDs are required.');
      return;
    }
    setLoading(true);
    try {
      const [tableData, menuData] = await Promise.all([
        fetchPublicTable(ids.restaurantId, ids.branchId, ids.tableId),
        fetchPublicMenu(ids.restaurantId, ids.branchId),
      ]);
      setTableInfo(tableData);
      setMenu(menuData);
      const cats = Object.keys(menuData.grouped || {});
      setActiveCategory(cats[0] || '');
      setSelectedItem(menuData.items?.[0] || null);
    } catch (err) {
      Alert.alert('Could not open menu', err.message);
    } finally {
      setLoading(false);
    }
  }, [canOpen, ids]);

  useEffect(() => {
    if (canOpen) loadApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrder = useCallback(async (silent = false) => {
    if (!currentOrderId) return;
    if (!silent) setOrderLoading(true);
    try {
      setCurrentOrder(await fetchPublicOrderStatus(currentOrderId));
    } catch (err) {
      if (!silent) Alert.alert('Could not load order', err.message);
    } finally {
      if (!silent) setOrderLoading(false);
    }
  }, [currentOrderId]);

  useEffect(() => {
    if (!currentOrderId) return undefined;
    loadOrder();
    const timer = setInterval(() => loadOrder(true), 10000);
    return () => clearInterval(timer);
  }, [currentOrderId, loadOrder]);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((row) => row._id === item._id);
      if (existing) {
        return prev.map((row) => row._id === item._id ? { ...row, qty: row.qty + 1 } : row);
      }
      return [...prev, { _id: item._id, name: item.name, price: item.price, qty: 1, imageUrl: imageFor(item), notes: '' }];
    });
  };

  const changeQty = (id, qty) => {
    if (qty <= 0) return setCart((prev) => prev.filter((item) => item._id !== id));
    setCart((prev) => prev.map((item) => item._id === id ? { ...item, qty } : item));
  };

  const submitOrder = async () => {
    if (!cart.length || submitting) return;
    setSubmitting(true);
    try {
      const items = cart.map((item) => ({ menuItem: item._id, quantity: item.qty, notes: item.notes || undefined }));
      if (currentOrderId) {
        const updated = await appendPublicOrderItems(currentOrderId, { items });
        setCurrentOrder(updated);
      } else {
        const created = await placePublicOrder({
          restaurantId: ids.restaurantId,
          branchId: ids.branchId,
          tableId: ids.tableId,
          items,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerNote: customerNote || undefined,
        });
        setCurrentOrderId(created.orderId);
      }
      setCart([]);
      setTab('track');
    } catch (err) {
      Alert.alert('Could not update order', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const viewBill = async () => {
    if (!currentOrderId) return;
    setBillLoading(true);
    try {
      setBill(await fetchPublicBill(currentOrderId));
    } catch (err) {
      Alert.alert('Could not load bill', err.message);
    } finally {
      setBillLoading(false);
    }
  };

  const callWaiter = async () => {
    try {
      await callPublicWaiter(currentOrderId);
      Alert.alert('Waiter notified');
    } catch (err) {
      Alert.alert('Could not call waiter', err.message);
    }
  };

  const askBill = async () => {
    try {
      await requestPublicBill(currentOrderId);
      await loadOrder();
    } catch (err) {
      Alert.alert('Could not request bill', err.message);
    }
  };

  const sendFeedback = async (payload) => {
    try {
      await submitPublicFeedback(currentOrderId, payload);
      Alert.alert('Thank you', 'Your feedback was submitted.');
    } catch (err) {
      Alert.alert('Could not submit feedback', err.message);
    }
  };

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  if (!tableInfo) {
    return <SetupScreen ids={ids} setIds={setIds} onLoad={loadApp} loading={loading} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>{tableInfo.restaurant?.name || 'RestroX'}</Text>
          <Text style={styles.mutedSmall}>{tableInfo.branch?.name || 'Branch'} · Table {tableInfo.table?.number || '-'}</Text>
        </View>
        <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>Add More {cartCount}</Text></View>
      </View>

      {tab === 'menu' && (
        <MenuScreen
          tableInfo={tableInfo}
          menu={menu}
          cart={cart}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          addToCart={addToCart}
          changeQty={changeQty}
        />
      )}
      {tab === 'order' && (
        <OrderScreen
          cart={cart}
          changeQty={changeQty}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerNote={customerNote}
          setCustomerNote={setCustomerNote}
          submitting={submitting}
          submitOrder={submitOrder}
          currentOrderId={currentOrderId}
          goTrack={() => setTab('track')}
          isAppendMode={isAppendMode}
        />
      )}
      {tab === 'track' && (
        <TrackScreen
          order={currentOrder}
          loading={orderLoading}
          refresh={() => loadOrder()}
          callWaiter={callWaiter}
          requestBill={askBill}
          viewBill={viewBill}
          submitFeedback={sendFeedback}
          billLoading={billLoading}
        />
      )}
      {tab === 'user' && (
        <UserScreen
          tableInfo={tableInfo}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerNote={customerNote}
          setCustomerNote={setCustomerNote}
        />
      )}

      <BottomNav tab={tab} setTab={setTab} currentOrderId={currentOrderId} openQr={() => setShowQr(true)} />
      <BillModal bill={bill} onClose={() => setBill(null)} />
      <QrModal visible={showQr} order={currentOrder} tableInfo={tableInfo} onClose={() => setShowQr(false)} />
    </SafeAreaView>
  );
}

function BillModal({ bill, onClose }) {
  if (!bill) return null;
  return (
    <Modal transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.eyebrow}>Running Bill</Text>
          <Text style={styles.title}>{bill.orderNumber}</Text>
          {bill.items?.map((item, index) => (
            <View key={`${item.name}-${index}`} style={styles.rowBetween}>
              <Text style={styles.itemLine}>{item.name} x{item.quantity}</Text>
              <Text style={styles.itemLine}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.rowBetween}><Text style={styles.total}>Total</Text><Text style={styles.total}>{formatCurrency(bill.totalAmount)}</Text></View>
          <Pressable onPress={onClose} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Close</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

function QrModal({ visible, order, tableInfo, onClose }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.eyebrow}>QR Payment</Text>
          <Text style={styles.title}>{order?.totalAmount ? formatCurrency(order.totalAmount) : 'No bill yet'}</Text>
          <Text style={styles.muted}>{tableInfo?.branch?.name || 'Branch'} · Table {tableInfo?.table?.number || '-'}</Text>
          <View style={styles.fakeQr}>
            {Array.from({ length: 25 }).map((_, index) => (
              <View key={index} style={[styles.qrCell, [0, 1, 3, 5, 6, 8, 10, 12, 13, 16, 18, 19, 21, 23, 24].includes(index) && styles.qrCellLight]} />
            ))}
          </View>
          <Text style={styles.notice}>Scan at counter or show this to staff for payment.</Text>
          <Pressable onPress={onClose} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Done</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#e9e9f1' },
  centerPage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  setupCard: { width: '100%', borderRadius: 28, backgroundColor: '#fff', padding: 22, gap: 12 },
  header: { margin: 12, marginBottom: 4, borderRadius: 24, backgroundColor: '#fff', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 22, fontWeight: '900', color: '#dc2626' },
  title: { fontSize: 24, fontWeight: '900', color: '#030712' },
  heroTitle: { fontSize: 34, fontWeight: '900', color: '#030712', marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#030712' },
  muted: { color: '#6b7280', fontWeight: '600' },
  mutedSmall: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  screen: { flex: 1 },
  screenContent: { padding: 12, paddingBottom: 110 },
  flex: { flex: 1, minWidth: 0 },
  mobileUserCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#dc2626', fontWeight: '900', fontSize: 18 },
  eyebrow: { color: '#dc2626', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', marginTop: 4 },
  categoryRow: { marginVertical: 12 },
  pill: { borderRadius: 999, backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 },
  pillActive: { backgroundColor: '#030712' },
  pillText: { color: '#4b5563', fontWeight: '800' },
  pillTextActive: { color: '#fff' },
  heroCard: { backgroundColor: '#fff', borderRadius: 28, padding: 18, marginBottom: 18 },
  heroImageBox: { borderRadius: 24, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', height: 260, overflow: 'hidden' },
  heroImage: { width: 230, height: 230, borderRadius: 115 },
  heroDescription: { color: '#64748b', fontWeight: '600', lineHeight: 20, marginTop: 10 },
  heroActions: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  price: { fontSize: 20, color: '#dc2626', fontWeight: '900' },
  heroAdd: { backgroundColor: '#030712', borderRadius: 999, paddingVertical: 13, paddingHorizontal: 22 },
  heroAddText: { color: '#fff', fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, color: '#64748b', fontWeight: '900', textTransform: 'uppercase' },
  moreTitle: { marginTop: 18, marginBottom: 8 },
  dishRow: { minHeight: 92, backgroundColor: '#fff', borderRadius: 22, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dishImage: { width: 64, height: 64, borderRadius: 18 },
  dishName: { color: '#030712', fontWeight: '900', fontSize: 15 },
  dishDescription: { color: '#94a3b8', fontWeight: '600', marginTop: 3 },
  dishPrice: { color: '#dc2626', fontWeight: '900', marginTop: 4 },
  addCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center' },
  addCircleText: { color: '#fff', fontWeight: '900', fontSize: 18 },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  qtyButtonDark: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: '#374151', fontWeight: '900' },
  qtyTextDark: { color: '#fff', fontWeight: '900' },
  qtyNumber: { width: 20, textAlign: 'center', fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14 },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5e7eb', borderRadius: 18, padding: 22, alignItems: 'center', marginTop: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  cartImage: { width: 56, height: 56, borderRadius: 28 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginVertical: 5 },
  input: { minHeight: 48, borderRadius: 14, backgroundColor: '#f9fafb', paddingHorizontal: 14, fontWeight: '700', marginTop: 10 },
  textArea: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
  notice: { backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: '800', padding: 12, borderRadius: 14, marginTop: 10 },
  totalLabel: { color: '#64748b', fontWeight: '800' },
  totalMuted: { color: '#64748b', fontWeight: '700' },
  total: { color: '#030712', fontWeight: '900', fontSize: 18 },
  primaryButton: { backgroundColor: '#dc2626', borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 14 },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
  outlineButton: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  outlineButtonText: { color: '#dc2626', fontWeight: '900' },
  disabledButton: { backgroundColor: '#d1d5db' },
  disabled: { opacity: 0.45 },
  trackHero: { backgroundColor: '#dc2626', borderRadius: 28, padding: 20, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' },
  trackTable: { color: '#fee2e2', fontWeight: '800' },
  trackOrder: { color: '#fff', fontSize: 28, fontWeight: '900' },
  trackCopy: { color: '#fee2e2', fontWeight: '700', marginTop: 4 },
  refreshButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  refreshText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  stepDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: '#fee2e2' },
  stepText: { color: '#9ca3af', fontWeight: '800' },
  stepTextDone: { color: '#030712' },
  itemLine: { color: '#374151', fontWeight: '800' },
  badge: { backgroundColor: '#f3f4f6', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, color: '#64748b', fontWeight: '800', overflow: 'hidden' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  actionGrid: { gap: 10, marginBottom: 14 },
  actionButton: { backgroundColor: '#fff', borderRadius: 999, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#fecaca' },
  actionText: { color: '#dc2626', fontWeight: '900' },
  darkActionButton: { backgroundColor: '#030712', borderRadius: 999, padding: 14, alignItems: 'center' },
  darkActionText: { color: '#fff', fontWeight: '900' },
  starRow: { flexDirection: 'row', gap: 5, marginVertical: 10 },
  star: { color: '#e5e7eb', fontSize: 30 },
  starActive: { color: '#fb923c' },
  bottomNav: { position: 'absolute', left: 8, right: 8, bottom: 8, height: 78, borderRadius: 30, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 18, elevation: 10 },
  navItem: { width: 58, alignItems: 'center', gap: 3 },
  navIcon: { fontSize: 21, color: '#9ca3af' },
  navText: { fontSize: 11, color: '#9ca3af', fontWeight: '900' },
  navActive: { color: '#dc2626' },
  navDisabled: { color: '#e5e7eb' },
  qrButton: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', marginTop: -30, borderWidth: 4, borderColor: '#e9e9f1' },
  qrButtonText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  cartBadge: { backgroundColor: '#dc2626', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  cartBadgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', padding: 12 },
  modalCard: { backgroundColor: '#fff', borderRadius: 28, padding: 20, gap: 8 },
  fakeQr: { alignSelf: 'center', width: 210, height: 210, backgroundColor: '#030712', borderRadius: 18, marginVertical: 14, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  qrCell: { width: 32, height: 32, backgroundColor: '#030712', borderRadius: 3 },
  qrCellLight: { backgroundColor: '#fff' },
});
