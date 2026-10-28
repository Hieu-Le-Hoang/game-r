// Map hộp nhỏ để test chuỗi compile SDHLT -> BSP có load được trên engine 2001 không.
import { box, type Entity } from './brush.ts';
import { blank, fill, tiles } from './proc.ts';
import type { TexDef } from './textures.ts';

export const BOX_TEXTURES: TexDef[] = [
  { name: 'bt_floor', scale: 1, make: async () => { const i = fill(blank(128, 128), [150, 120, 90], 0.15, 3); tiles(i, 32, 32, 2, [70, 60, 50]); return i; } },
  { name: 'bt_wall', scale: 1, make: async () => fill(blank(128, 128), [220, 190, 110], 0.2, 7) },
];

export function boxMap(wads: string): Entity[] {
  const W = 'bt_wall';
  return [
    {
      props: { classname: 'worldspawn', mapversion: '220', wad: wads, skyname: 'city1', message: 'cs_bt_box (test compile)' },
      brushes: [
        box([-512, -512, -16], [512, 512, 0], { side: W, top: 'bt_floor' }),
        box([-512, -512, 256], [512, 512, 272], 'sky'),
        box([-528, -512, -16], [-512, 512, 272], W),
        box([512, -512, -16], [528, 512, 272], W),
        box([-528, -528, -16], [528, -512, 272], W),
        box([-528, 512, -16], [528, 528, 272], W),
        box([-64, -64, 0], [64, 64, 64], W),
      ],
    },
    { props: { classname: 'light_environment', origin: '0 0 200', angles: '-60 45 0', pitch: '-60', _light: '255 240 210 250', _diffuse_light: '160 180 220 80' } },
    { props: { classname: 'info_player_start', origin: '0 -400 36', angle: '90' } },
    { props: { classname: 'info_player_deathmatch', origin: '0 400 36', angle: '270' } },
    { props: { classname: 'hostage_entity', origin: '200 400 36', angle: '270' } },
    { props: { classname: 'info_hostage_rescue', origin: '0 -400 36' } },
  ];
}
