import { describe, expect, it } from 'vitest';
import { brandKey, groupAssets, type GroupableAsset } from './client-grouping';

describe('brandKey', () => {
  it('drops handles, domains and noise words', () => {
    expect(brandKey('ziply5_official')).toBe('ziply5');
    expect(brandKey('francoleone.in')).toBe('francoleone');
    expect(brandKey('seere.india')).toBe('seere');
    expect(brandKey('evriddhiofficial')).toBe('evriddhi');
    expect(brandKey('rnmittalindia')).toBe('rnmittal');
    expect(brandKey('Heritage Weves Ads')).toBe('heritageweves');
    expect(brandKey('@podo.crm')).toBe('podocrm');
  });

  it('never strips a short brand down to nothing', () => {
    expect(brandKey('Ads')).toBe('ads');
    expect(brandKey('India Shop')).toBe('india');
  });
});

describe('groupAssets', () => {
  const assets: GroupableAsset[] = [
    { kind: 'channel', id: 'ig1', name: 'heritageweves', provider: 'Instagram' },
    { kind: 'channel', id: 'fb1', name: 'Heritage Weves', provider: 'Facebook' },
    { kind: 'meta_ad', id: 'act_1', name: 'Heritage Weves Ads' },
    { kind: 'channel', id: 'ig2', name: 'ziply5_official', provider: 'Instagram' },
    { kind: 'meta_ad', id: 'act_2', name: '411505106650337', username: null },
  ];

  it('puts the same brand from different platforms in one group with a human name', () => {
    const groups = groupAssets(assets, []);
    const heritage = groups.find((g) => g.key === 'heritageweves');
    expect(heritage?.assets.map((a) => a.id).sort()).toEqual(['act_1', 'fb1', 'ig1']);
    expect(heritage?.suggestedName).toBe('Heritage Weves');
    expect(groups.find((g) => g.key === 'ziply5')?.suggestedName).toBe('Ziply5');
  });

  it('matches an existing client by name', () => {
    const groups = groupAssets(assets, [{ id: 'c1', name: 'Heritage Weves' }]);
    const heritage = groups.find((g) => g.key === 'heritageweves');
    expect(heritage?.clientId).toBe('c1');
    expect(heritage?.suggestedName).toBe('Heritage Weves');
  });

  it('merges a longer variant into the shorter brand key', () => {
    const groups = groupAssets(
      [
        { kind: 'channel', id: 'a', name: 'houseofvaynijaipur' },
        { kind: 'channel', id: 'b', name: 'houseofvayni' },
      ],
      []
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('houseofvayni');
  });
});
