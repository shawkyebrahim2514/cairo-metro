import { describe, expect, it } from 'vitest';
import { parsePlaceInput } from './link-parser';

const coords = (lat: number, lng: number) => ({ kind: 'coords', point: { lat, lng } });

describe('parsePlaceInput', () => {
  it('returns null for empty input', () => {
    expect(parsePlaceInput('   ')).toBeNull();
  });

  it('parses plain coordinates', () => {
    expect(parsePlaceInput('30.0444, 31.2357')).toMatchObject(coords(30.0444, 31.2357));
    expect(parsePlaceInput('(30.05 31.24)')).toMatchObject(coords(30.05, 31.24));
  });

  it('prefers the !3d!4d pin over the @ viewport', () => {
    const url =
      'https://www.google.com/maps/place/Cairo+Tower/@30.0459,31.2243,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d30.0458!4d31.2243';
    expect(parsePlaceInput(url)).toMatchObject({
      kind: 'coords',
      point: { lat: 30.0458, lng: 31.2243 },
      label: 'Cairo Tower',
    });
  });

  it('falls back to @lat,lng', () => {
    expect(parsePlaceInput('https://www.google.com/maps/@30.0131,31.2089,15z')).toMatchObject(
      coords(30.0131, 31.2089),
    );
  });

  it('parses q=, ll= and query= coordinates', () => {
    expect(parsePlaceInput('https://maps.google.com/?q=30.1,31.3')).toMatchObject(
      coords(30.1, 31.3),
    );
    expect(parsePlaceInput('https://maps.google.com/?ll=30.2,31.4&z=10')).toMatchObject(
      coords(30.2, 31.4),
    );
    expect(
      parsePlaceInput('https://www.google.com/maps/search/?api=1&query=30.3%2C31.5'),
    ).toMatchObject(coords(30.3, 31.5));
  });

  it('extracts a place name when there are no coordinates', () => {
    expect(parsePlaceInput('https://www.google.com/maps/place/City+Stars+Mall')).toEqual({
      kind: 'text',
      query: 'City Stars Mall',
    });
    expect(parsePlaceInput('https://www.google.com/maps?q=Cairo+Opera+House')).toEqual({
      kind: 'text',
      query: 'Cairo Opera House',
    });
  });

  it('handles directions links by taking the destination', () => {
    expect(
      parsePlaceInput('https://www.google.com/maps/dir/Giza+Zoo/Khan+El+Khalili/@30,31,12z'),
    ).toEqual({ kind: 'text', query: 'Khan El Khalili' });
  });

  it('flags short links for expansion', () => {
    expect(parsePlaceInput('https://maps.app.goo.gl/AbC123')).toEqual({
      kind: 'short',
      url: 'https://maps.app.goo.gl/AbC123',
    });
  });

  it('treats other text as a place name, including Arabic', () => {
    expect(parsePlaceInput('سيتي ستارز')).toEqual({ kind: 'text', query: 'سيتي ستارز' });
    expect(parsePlaceInput('Tahrir Square')).toEqual({ kind: 'text', query: 'Tahrir Square' });
  });

  it('rejects out-of-range coordinates as text', () => {
    expect(parsePlaceInput('95, 200')).toEqual({ kind: 'text', query: '95, 200' });
  });
});
