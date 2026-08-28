import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { COLORS, SPACING, RADIUS } from '../utils/constants';

const PSGC_BASE = 'https://psgc.gitlab.io/api';

// ─── Dropdown Picker ──────────────────────────────────
function Dropdown({ label, value, placeholder, options, onSelect, loading, disabled }) {
  const [visible, setVisible] = useState(false);
  const [search,  setSearch]  = useState('');

  const filtered = options.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find(o => o.code === value);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdownBtn, disabled && styles.dropdownDisabled]}
        onPress={() => { if (!disabled) setVisible(true); }}
        activeOpacity={0.8}
      >
        {loading
          ? <ActivityIndicator size="small" color={COLORS.primary}/>
          : <>
              <Text style={[styles.dropdownText, !selected && styles.dropdownPlaceholder]}>
                {selected?.name || placeholder}
              </Text>
              <Feather name="chevron-down" size={16} color={COLORS.textMuted}/>
            </>
        }
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { setVisible(false); setSearch(''); }}>
                <Feather name="x" size={20} color={COLORS.textMuted}/>
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrap}>
              <Feather name="search" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }}/>
              <TextInput
                style={styles.searchInput}
                placeholder={`Search ${label}...`}
                placeholderTextColor={COLORS.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>
            <FlatList
              data={filtered}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionRow, item.code === value && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                    setSearch('');
                  }}
                >
                  <Text style={[styles.optionText, item.code === value && styles.optionTextSelected]}>
                    {item.name}
                  </Text>
                  {item.code === value && <Feather name="check" size={14} color={COLORS.primary}/>}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No results found</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Main PSGC Address Picker ────────────────────────
export default function PSGCAddressPicker({ value = {}, onChange }) {
  const [regions,   setRegions]   = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities,    setCities]    = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [loadingRegions,   setLoadingRegions]   = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities,    setLoadingCities]    = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const [selected, setSelected] = useState({
    regionCode:   value.regionCode   || '',
    regionName:   value.regionName   || '',
    provinceCode: value.provinceCode || '',
    provinceName: value.provinceName || '',
    cityCode:     value.cityCode     || '',
    cityName:     value.cityName     || '',
    barangayCode: value.barangayCode || '',
    barangayName: value.barangayName || '',
    street:       value.street       || '',
    zip_code:     value.zip_code     || '',
  });

  // Load regions on mount
  useEffect(() => {
    loadRegions();
  }, []);

  // Load provinces when region changes
  useEffect(() => {
    if (selected.regionCode) loadProvinces(selected.regionCode);
    else { setProvinces([]); setCities([]); setBarangays([]); }
  }, [selected.regionCode]);

  // Load cities when province changes
  useEffect(() => {
    if (selected.provinceCode) loadCities(selected.provinceCode);
    else { setCities([]); setBarangays([]); }
  }, [selected.provinceCode]);

  // Load barangays when city changes
  useEffect(() => {
    if (selected.cityCode) loadBarangays(selected.cityCode);
    else setBarangays([]);
  }, [selected.cityCode]);

  async function loadRegions() {
    setLoadingRegions(true);
    try {
      const res  = await fetch(`${PSGC_BASE}/regions/`);
      const data = await res.json();
      setRegions(data.map(r => ({ code: r.code, name: r.name })).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error('PSGC regions error:', e); }
    finally { setLoadingRegions(false); }
  }

  async function loadProvinces(regionCode) {
    setLoadingProvinces(true);
    try {
      const res  = await fetch(`${PSGC_BASE}/regions/${regionCode}/provinces/`);
      const data = await res.json();
      setProvinces(data.map(p => ({ code: p.code, name: p.name })).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error('PSGC provinces error:', e); }
    finally { setLoadingProvinces(false); }
  }

  async function loadCities(provinceCode) {
    setLoadingCities(true);
    try {
      const res  = await fetch(`${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities/`);
      const data = await res.json();
      setCities(data.map(c => ({ code: c.code, name: c.name })).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error('PSGC cities error:', e); }
    finally { setLoadingCities(false); }
  }

  async function loadBarangays(cityCode) {
    setLoadingBarangays(true);
    try {
      const res  = await fetch(`${PSGC_BASE}/cities-municipalities/${cityCode}/barangays/`);
      const data = await res.json();
      setBarangays(data.map(b => ({ code: b.code, name: b.name })).sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error('PSGC barangays error:', e); }
    finally { setLoadingBarangays(false); }
  }

  function update(patch) {
    const newSelected = { ...selected, ...patch };
    setSelected(newSelected);
    onChange && onChange(newSelected);
  }

  return (
    <View>
      {/* Region */}
      <Dropdown
        label="Region *"
        value={selected.regionCode}
        placeholder="Select Region"
        options={regions}
        loading={loadingRegions}
        onSelect={r => update({
          regionCode: r.code, regionName: r.name,
          provinceCode: '', provinceName: '',
          cityCode: '', cityName: '',
          barangayCode: '', barangayName: '',
        })}
      />

      {/* Province */}
      <Dropdown
        label="Province *"
        value={selected.provinceCode}
        placeholder="Select Province"
        options={provinces}
        loading={loadingProvinces}
        disabled={!selected.regionCode}
        onSelect={p => update({
          provinceCode: p.code, provinceName: p.name,
          cityCode: '', cityName: '',
          barangayCode: '', barangayName: '',
        })}
      />

      {/* City / Municipality */}
      <Dropdown
        label="City / Municipality *"
        value={selected.cityCode}
        placeholder="Select City / Municipality"
        options={cities}
        loading={loadingCities}
        disabled={!selected.provinceCode}
        onSelect={c => update({
          cityCode: c.code, cityName: c.name,
          barangayCode: '', barangayName: '',
        })}
      />

      {/* Barangay */}
      <Dropdown
        label="Barangay *"
        value={selected.barangayCode}
        placeholder="Select Barangay"
        options={barangays}
        loading={loadingBarangays}
        disabled={!selected.cityCode}
        onSelect={b => update({ barangayCode: b.code, barangayName: b.name })}
      />

      {/* Street */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Street / House No.</Text>
        <View style={styles.inputRow}>
          <Feather name="map-pin" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }}/>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Block 2, Osmeña St."
            placeholderTextColor={COLORS.textMuted}
            value={selected.street}
            onChangeText={v => update({ street: v })}
          />
        </View>
      </View>

      {/* Zip Code */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Zip Code</Text>
        <View style={styles.inputRow}>
          <Feather name="hash" size={14} color={COLORS.textMuted} style={{ marginRight: 8 }}/>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 9506"
            placeholderTextColor={COLORS.textMuted}
            value={selected.zip_code}
            onChangeText={v => update({ zip_code: v })}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Helper: Convert PSGC selection to address string ─
export function psgcToAddressString(psgc) {
  return [
    psgc.street,
    psgc.barangayName,
    psgc.cityName,
    psgc.provinceName,
    psgc.regionName,
    psgc.zip_code,
  ].filter(Boolean).join('|');
}

// ─── Helper: Convert address string to PSGC parts ────
export function addressStringToParts(addr) {
  const parts = (addr || '').split('|');
  return {
    street:       parts[0]?.trim() || '',
    barangayName: parts[1]?.trim() || '',
    cityName:     parts[2]?.trim() || '',
    provinceName: parts[3]?.trim() || '',
    regionName:   parts[4]?.trim() || '',
    zip_code:     parts[5]?.trim() || '',
  };
}

const styles = StyleSheet.create({
  fieldWrap:           { marginBottom: SPACING.sm },
  label:               { fontSize: 12, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  dropdownBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44 },
  dropdownDisabled:    { backgroundColor: COLORS.grayBg, opacity: 0.6 },
  dropdownText:        { fontSize: 14, color: COLORS.dark, flex: 1 },
  dropdownPlaceholder: { color: COLORS.textMuted },
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard:           { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 20 },
  modalHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  modalTitle:          { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  searchWrap:          { flexDirection: 'row', alignItems: 'center', margin: SPACING.sm, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.grayBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.grayBorder },
  searchInput:         { flex: 1, fontSize: 14, color: COLORS.dark },
  optionRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.grayBorder },
  optionSelected:      { backgroundColor: 'rgba(22,163,74,0.06)' },
  optionText:          { fontSize: 14, color: COLORS.dark, flex: 1 },
  optionTextSelected:  { color: COLORS.primary, fontWeight: '600' },
  emptyText:           { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.lg },
  inputRow:            { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.grayBorder, borderRadius: RADIUS.sm, backgroundColor: COLORS.white, paddingHorizontal: 12, paddingVertical: 10 },
  textInput:           { flex: 1, fontSize: 14, color: COLORS.dark },
});