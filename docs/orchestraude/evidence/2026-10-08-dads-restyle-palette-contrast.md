---
id: 2026-10-08-dads-restyle-palette-contrast
question: For decision 040 (DADS-inspired restyle), which DADS primitive colors does the light/dark palette use, and do all text and non-text pairs meet WCAG contrast (4.5:1 / 3:1)?
source: dist/tokens.css of npm @digital-go-jp/design-tokens 2.0.1 (npm pack, read locally); local node script implementing the WCAG 2.x relative-luminance contrast formula, run 2026-10-08
fetched: 2026-10-08
expires: 2027-01-06
---
Learned (palette values read from tokens.css 2.0.1, beyond those in 2026-10-08-dads-design-tokens-package):
- blue-50 #e8f1fe, -200 #c5d7fb, -300 #9db7f9, -100 #d9e6ff, -1000 #00118f, -1100 #000071, -1200 #000060; red-50 #fdeeee, -200 #ffbbbb, -300 #ff9696, -400 #ff7171, -900 #ce0000, -1000 #a90000, -1100 #850000, -1200 #620000; green-300 #71c598, -800 #197a4b; yellow-300 #ffd43d, -400 #ffc700, -900 #927200; gray-50 #f2f2f2, -100 #e6e6e6, -300 #b3b3b3, -400 #999999, -420 #949494, -536 #767676, -600 #666666, -800 #333333, -900 #1a1a1a.
Computed contrast, light (bg #ffffff, alt #f2f2f2):
- Text: #333333 12.63 / 11.29; #1a1a1a 17.40 / 15.55; muted #666666 5.74 / 5.13 (5.04 on #e8f1fe); link #00118f 14.22 / 12.70 (12.49 on #e8f1fe); link hover #000071 16.96; white on #0017c1 11.10, on #00118f 14.22, on #000060 17.97; #0017c1 on #c5d7fb 7.65, #00118f on #c5d7fb 9.81; white on #ce0000 5.79, on #a90000 7.82, on #850000 10.51; #ce0000 on white 5.79, on #f2f2f2 5.18, on #fdeeee 5.14; #a90000 on #fdeeee 6.94; black on #ffd43d 14.74.
- Non-text: #197a4b 5.35 / 4.78; #927200 4.54 / 4.05; #949494 3.03; #666666 5.74; focus outline #000000 21.00 / 18.76; halo #ffd43d vs #0017c1 7.79.
Computed contrast, dark (bg #1a1a1a, alt #262626):
- Text: #f2f2f2 15.55 / 13.52; #ffffff 17.40 / 15.13; muted #b3b3b3 8.30 / 7.22 (8.09 on #000071); link #9db7f9 8.76 / 7.62 (8.54 on #000071); link hover #c5d7fb 12.01; #000060 on #9db7f9 9.05, on #c5d7fb 12.39, on #d9e6ff 14.30; #c5d7fb on #000071 11.70; #1a1a1a on #ff7171 6.51, on #ff9696 8.33, on #ffbbbb 10.84; #ff7171 on #1a1a1a 6.51, on #262626 5.66, on #620000 5.17; #ff9696 on #620000 6.62; #f2f2f2 on #000071 15.15.
- Non-text: #71c598 8.41 / 7.31; #ffc700 11.12 / 9.67; border #767676 3.83 / 3.33; #999999 6.11 / 5.31; #e6e6e6 13.94; focus outline #ffd43d 12.21 / 10.62; outline vs black halo 14.74; black halo vs #9db7f9 10.57.
- Rejected options: black outline #000000 on dark bg #1a1a1a 1.21 (DADS ring unchanged in dark mode); DADS error red-800 #ec0000 on #f2f2f2 4.11.
- Every pair above used as text is >= 4.5:1, every non-text pair >= 3:1.
Not confirmed: rendering in real browsers (antialiasing, forced-colors mode, the halo drawn by box-shadow inside the outline offset); pairs not listed (e.g. hover states over zebra rows) were not computed.
