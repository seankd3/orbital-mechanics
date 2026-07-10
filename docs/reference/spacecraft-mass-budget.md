# Apollo CSM Mass Budget

Quick reference compiled from SM2A-03-SC012 Apollo Operations Handbook
and standard Apollo program references. Basic Date 12 Nov 1966.

NOTE: The handbook (SM2A-03-SC012) defers detailed weight status to
an external weight status document. Values below combine handbook
propellant data with well-known Apollo program mass figures.

## CSM Mass Summary (Typical Lunar Mission)

    COMMAND MODULE (dry) ......... ~12,250 lbs  (5,557 kg)
    SERVICE MODULE (dry) ......... ~11,500 lbs  (5,216 kg)
    SPS PROPELLANT (loaded) ...... 45,900 lbs   (20,820 kg)
    SM RCS PROPELLANT (4 quads) .. ~824 lbs     (374 kg)
    CM RCS PROPELLANT (2 sys) .... ~270 lbs     (122 kg)
    CREW + EQUIPMENT ............. ~1,100 lbs   (499 kg)
    -------------------------------------------------------
    CSM TOTAL (approximate) ...... ~63,500 lbs  (28,800 kg)

## Propellant Mass Detail (from handbook)

### SPS Propellant

    OXIDIZER LOADED .............. 30,600 lbs (13,880 kg)
    OXIDIZER USABLE .............. 27,333 lbs (12,398 kg)
    FUEL LOADED .................. 15,300 lbs (6,940 kg)
    FUEL USABLE .................. 13,677 lbs (6,204 kg)
    TOTAL LOADED ................. 45,900 lbs (20,820 kg)
    TOTAL USABLE ................. 41,010 lbs (18,602 kg)
    RESIDUAL + RESERVES .......... 4,890 lbs  (2,218 kg)

### S/M RCS Propellant (per quad)

    FUEL (MMH) ................... 69.0 lbs   (31.3 kg)
    OXIDIZER (N2O4) .............. 137.0 lbs  (62.1 kg)
    TOTAL PER QUAD ............... 206.0 lbs  (93.4 kg)
    TOTAL 4 QUADS ................ 824 lbs    (373.8 kg)

## Key Mass Ratios

    CSM FULLY LOADED ............. ~28,800 kg
    CSM DRY (no SPS prop) ........ ~10,198 kg
    MASS RATIO (loaded/dry) ...... 2.824
    SPS PROPELLANT FRACTION ...... 0.646

## Delta-V Capability (SPS)

    Isp = 314 sec (vacuum)
    g0 = 9.81 m/s^2
    Ve = 314 * 9.81 = 3,080 m/s

    FULL LOAD:
    dV = 3,080 * ln(28,800 / 10,198) = ~3,200 m/s

    This delta-V budget covers:
    - lunar orbit insertion (~900 m/s)
    - trans-earth injection (~1,000 m/s)
    - midcourse corrections (~200 m/s)
    - margin (~1,100 m/s)

## Component Weights (from handbook)

    SPS ENGINE (dry) ............. ~650 lbs  (295 kg)
    S/M RCS ENGINE (each) ........ 4.99 lbs  (2.26 kg)
    S/M RCS ENGINES (16 total) ... 79.8 lbs  (36.2 kg)
    S/M RCS He TANK (each) ....... 0.57 lb He capacity
    SPS He TANK (each) ........... 19.4 cu ft, ~40 in dia

## Simulator Values

    For the orbital mechanics simulator (Earth orbit only):

    SPACECRAFT MASS .............. 28,800 kg (recommended)
    SPS THRUST ................... 91,189 N
    SPS Isp ...................... 314 sec
    RCS THRUST (per jet) ......... 445 N
    USABLE PROPELLANT ............ 18,602 kg

    Initial orbit (ISS-like):
    ALTITUDE ..................... 400 km
    VELOCITY ..................... ~7,672 m/s
    PERIOD ....................... ~92.4 min

## Source References

    Propellant data: Section 2.4.3 and 2.5.4, SM2A-03-SC012
    Mass figures: Standard Apollo program references (NASA SP-368)
    Performance: Mission Modular Data Book, SID 66-1177
