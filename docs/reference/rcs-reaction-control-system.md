# RCS - Reaction Control System

Quick reference extracted from SM2A-03-SC012 Apollo Operations Handbook,
Spacecraft 012, Section 2.5. Basic Date 12 Nov 1966.

## System Overview

    Two independent RCS systems on the Apollo CSM:
    - S/M RCS: 16 engines in 4 quads on the Service Module
    - C/M RCS: 12 engines in 2 systems (A+B) on the Command Module

    S/M RCS handles attitude control during normal flight.
    C/M RCS takes over after CM/SM separation for entry.

---

## S/M RCS Engines

    THRUST PER ENGINE ..... 100 lbs +/-5% (445 N)
    ENGINE COUNT .......... 16 (4 quads x 4 engines)
    ENGINE WEIGHT ......... 4.99 lbs (2.26 kg)
    ENGINE LENGTH ......... 13.375 in (0.34 m)
    NOZZLE EXIT DIA ....... 5.6 in (0.142 m)
    EXPANSION RATIO ....... 40:1
    SERVICE LIFE .......... 1,000 sec
    OPERATIONAL CYCLES .... 10,000
    COOLING ............... film and radiation
    CHAMBER MATERIAL ...... unalloyed molybdenum
                            (molybdenum disilicide coating)
    NOZZLE MATERIAL ....... L-605 (cobalt alloy)
    INJECTOR .............. premix igniter, unlike impingement
                            8 fuel annulus for film cooling
                            8 unlike impingement pairs (main)
                            8 fuel holes for chamber wall cooling

### Valve Timing

    AUTOMATIC COIL:
      fuel opens in ........ 4.5+/-1.5 ms
      oxidizer opens in .... 6.0+/-1.5 ms
      fuel lead ............ ~2 ms
    MANUAL (DIRECT) COIL:
      opens in ............. 13 ms (fuel), 23 ms (oxidizer)
      closes in ............ 55+/-25 ms (both)
    MIN SCS PULSE WIDTH ... 18+/-4 ms (14 ms minimum)
    STEADY STATE .......... reached in ~1 sec

## S/M RCS Quad Layout

    4 quads (A, B, C, D) at 90-deg intervals around SM
    Located on forward (+X axis) portion of SM periphery
    Offset from Y and Z axes by 7 deg 15 min
    Engines canted 10 deg away from SM panel surface
    Two roll engines per quad are offset-mounted

### Engine Functions Per Quad

    Engine 1: +pitch / +Y translation
    Engine 2: -pitch / -Y translation
    Engine 3: +yaw / +Z translation (or roll depending on quad)
    Engine 4: -yaw / -Z translation (or roll depending on quad)

    (See Figure 2.5-2 for complete firing sequence table)

## S/M RCS Propellants

    OXIDIZER .............. nitrogen tetroxide (N2O4)
    FUEL .................. monomethylhydrazine (MMH)
    O/F RATIO ............. 2:1 by weight
    IGNITION .............. hypergolic (on contact)

### Propellant Per Quad

    FUEL TANK ............. 69.0 lbs combined propellant + ullage
    OXIDIZER TANK ......... 137.0 lbs combined propellant + ullage
    TOTAL PER QUAD ........ ~206 lbs (~93 kg)
    TOTAL 4 QUADS ......... ~824 lbs (~374 kg)

### Tank Specs

    FUEL TANK DIA ......... 12.62 in outside max
    FUEL TANK LEN ......... 23.717 in
    FUEL WALL ............. 0.017 to 0.022 in
    FUEL FILL PRESS ....... 30+/-2 psig at 60F
    OXIDIZER TANK DIA ..... 12.62 in outside max
    OXIDIZER TANK LEN ..... 28.55 in
    OXIDIZER WALL ......... 0.017 to 0.022 in
    OXIDIZER FILL PRESS ... 30+/-2 psig at 65F
    WORKING PRESSURE ...... <215 psia when heated to 85F

## S/M RCS Pressurization

    HELIUM TANKS (4) ...... 4150+/-50 psig at 70+/-5 F
    TANK CAPACITY ......... 0.57 lb helium
    TANK DIAMETER ......... 8.84 in inside
    TANK WALL ............. 0.105 in
    TANK VOLUME ........... 0.205 cu ft
    LIMIT WORKING PRESS ... 5000 psig
    BURST PRESSURE ........ 7500 psig
    PRIMARY REGULATOR ..... 181+/-4 psig (lockup 183+/-5)
    SECONDARY REGULATOR ... 187+/-5 psig
    RELIEF DIAPHRAGM ...... ruptures 228+/-8 psig
    RELIEF VALVE .......... relieves 236.5+/-11.5 psig

## S/M RCS Propellant Remaining (Nomogram)

    Determined by helium tank pressure + temperature.
    Example: 3400 psia He, 265 psia temp (=100F)
             => ~60% remaining = ~120 lbs per quad

---

## C/M RCS Engines

    ENGINE COUNT .......... 12 (2 systems x 6 engines)
    SYSTEMS ............... A and B (independent)
    PROPELLANTS ........... N2O4/MMH, 2:1 O/F, hypergolic
    FUNCTION .............. attitude control after CM/SM sep
                            and during entry
    NO TRANSLATION ........ C/M RCS has rotation only

    (C/M RCS engine thrust is same class as S/M RCS
     but handbook does not state separate C/M specs
     in this section - defers to SID 66-1177)

## Operational Limits

    - He/propellant isolation valves: min 0.2 sec, max 5 sec energization
    - Auto coil: max 2 min on-time in any 15-min period, <=32 vdc
    - Direct coil: max 45 min on-time in any 60-min period, <=16 vdc
    - C/M RCS engines may need preheating before pressurization
      (oxidizer freezes at +11.8F)

## Power Consumption

    ENGINE HEATERS ........ 36.0 W each, 288 W total (8 heaters)
    ENGINE COILS (auto) ... 3.687 W each, 118 W total (32 S/M)
    ENGINE COILS (direct) . 1.062 W each, 34 W total (32 S/M)
    He ISOLATION VALVES ... 6.750 W each, 54 W total
    PROP ISOLATION VALVES . 6.125 W each, 49 W total

## Source References

    Section 2.5, SM2A-03-SC012
    Performance data: Mission Modular Data Book, SID 66-1177
    Figures: 2.5-1 through 2.5-8
