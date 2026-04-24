# SPS - Service Propulsion System

Quick reference extracted from SM2A-03-SC012 Apollo Operations Handbook,
Spacecraft 012, Section 2.4. Basic Date 12 Nov 1966.

## Engine (AJ10-137)

    THRUST .............. 20,500 lbf (91,189 N)
    SPECIFIC IMPULSE ..... ~314 sec (vacuum)
    PROPELLANT FLOW ...... 45.27 lbs/sec (normal, 70F, 168 psig)
    MIN IMPULSE .......... 0.4 sec
    SERVICE LIFE ......... 500 sec (S/C 014)
    RESTARTS ............. 36 capable
    ENGINE WEIGHT ........ ~650 lbs (295 kg)
    ENGINE LENGTH ........ 152.82 in (3.88 m)
    NOZZLE EXIT DIA ...... 94.4 in (2.40 m)
    EXPANSION RATIO ...... 6:1 ablative chamber
                           62.5:1 nozzle extension exit
    COOLING .............. ablation (chamber), radiation (extension)
    INJECTOR ............. baffled, regen-cooled, unlike impingement
    COMBUSTION STABILITY .. 180 g peak-to-peak, 70+/-20 ms
                           monitor range 600-5000 cps

## Propellants

    TYPE ................. hypergolic bipropellant
    OXIDIZER ............. nitrogen tetroxide (N2O4)
    FUEL ................. Aerozine-50 (50/50 UDMH/N2H4)
    O/F RATIO ............ 2:1 by weight

### Tank Capacities

    OXIDIZER (total) ..... 30,600 lbs (13,880 kg)
    OXIDIZER (usable) .... 27,333 lbs (12,398 kg)
    FUEL (total) ......... 15,300 lbs (6,940 kg)
    FUEL (usable) ........ 13,677 lbs (6,204 kg)
    TOTAL (loaded) ....... 45,900 lbs (20,820 kg)
    TOTAL (usable) ....... 41,010 lbs (18,602 kg)

### Tank Specs

    OXIDIZER TANK VOL .... 175 cu ft each (storage + sump)
    OXIDIZER TANK DIA .... 51 in inside
    OXIDIZER TANK LEN .... 165.4 in
    OXIDIZER WALL ........ 0.060 in continuous, 0.069 in weld
    FUEL TANK VOL ........ 139.7 cu ft each (storage + sump)
    FUEL TANK DIA ........ 45 in inside
    FUEL TANK LEN ........ 166.8 in
    FUEL WALL ............ 0.053 in continuous, 0.061 in weld
    WORKING PRESSURE ..... 175+/-4 psia

## Pressurization

    HELIUM TANKS (2) ..... 4000+/-50 psia fill, 4400 max
                           operating 70+/-10 F
                           capacity 19.4 cu ft
                           diameter 40 in inside
                           wall 0.46 in
    PRIMARY REGULATOR .... 186+/-4 psig
    SECONDARY REGULATOR .. 191+/-4 psig
    PRIMARY LOCKUP ....... 200 psig
    SECONDARY LOCKUP ..... 205 psig
    RELIEF VALVE ......... ruptures 220+/-7 psig
                           relieves 232+/-8 psig
                           reseats 212 psig min
    GN2 SUPPLY ........... 2500+/-50 psi at 68F
                           supports 36 valve actuations

## Thrust Vector Control (Gimbal)

    PITCH (Y-Y axis) ..... +/-6 (+1/2, -0) deg
    YAW (Z-Z axis) ....... +/-7 (+1/2, -0) deg
    SNUBBING STOP ........ +1 deg beyond normal limits
    PITCH NULL OFFSET ..... 0 deg
    YAW NULL OFFSET ....... +4 deg (CG offset on +Y axis)
    ACTUATOR SLEW RATE ... 0.23 rad/sec (13.09 deg/sec)
    ACTUATOR TYPE ........ electromechanical, magnetic particle clutch
    CLUTCH QUIESCENT ..... 60 (+10, -5) mA
    MOTORS-OFF FORCE ..... 246 ft-lb (1.53 g equivalent)

## Operational Limits

    - Propellant gauging only operational during engine firing
    - 4.5-sec firing required before propellant quantity updates
    - 1-sec delay between GIMBAL MOTOR switch actuations
    - Gimbal motors should not run >12 min continuously
    - Single bank operation: 3% thrust reduction

## Delta-V Budget (derived)

    With CSM mass ~28,800 kg and 18,602 kg usable propellant:
    Dry mass ~10,198 kg
    Mass ratio = 28,800 / 10,198 = 2.824
    Delta-V = 314 * 9.81 * ln(2.824) = ~3,200 m/s

## Source References

    Section 2.4, SM2A-03-SC012
    Performance data: Mission Modular Data Book, SID 66-1177
    Figures: 2.4-1 through 2.4-11
