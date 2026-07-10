# Apollo CSM Quick Reference

Extracted from **SM2A-03-SC012** Apollo Operations Handbook, Spacecraft 012.
North American Aviation, Inc. / NASA Contract NAS9-150. Basic Date 12 Nov 1966.

Source PDF: `docs/external/SM2A-03-SC012-ApolloOperationsHandbook-Spacecraft012.pdf`

---

## At a Glance

    SPACECRAFT ......... Apollo Block I CSM (Spacecraft 012)
    CREW ............... 3
    TOTAL MASS ......... ~28,800 kg (63,500 lbs)
    MAIN ENGINE ........ 91,189 N (20,500 lbf) SPS
    ATTITUDE JETS ...... 445 N (100 lbf) x16 S/M RCS
    MAX DELTA-V ........ ~3,200 m/s (SPS)
    SAS MAX RATE ....... 0.79 deg/sec (orbital flight)
    RATE DEADBAND ...... 0.2 deg/sec

---

## Reference Documents

| Document | Contents |
|---|---|
| [SPS - Service Propulsion System](sps-service-propulsion-system.md) | Main engine specs, propellant tanks, gimbal, pressurization |
| [RCS - Reaction Control System](rcs-reaction-control-system.md) | Attitude thrusters, S/M and C/M RCS, quad layout |
| [SCS - Stabilization and Control](scs-stabilization-control.md) | Rate limits, deadbands, control modes, SAS behavior |
| [Spacecraft Mass Budget](spacecraft-mass-budget.md) | Mass breakdown, propellant budgets, delta-V capability |

---

## Simulator Parameter Mapping

    HANDBOOK SYSTEM            SIMULATOR CONTROL     VALUE
    ----------------------------------------------------------------
    SPS engine thrust          SPACE key             91,189 N
    S/M RCS jet thrust         W/S/A/D/Q/E keys     445 N per jet
    SCS attitude hold          T key (SAS toggle)    rate + attitude hold
    SCS orbital rate limit     max rotation rate     0.79 deg/sec
    SCS rate deadband          SAS deadband          0.2 deg/sec
    SCS minimum impulse        jet pulse duration    ~18 ms
    Time warp                  ,/. keys              1x - 1000x

    SPACECRAFT PARAMETERS      SIMULATOR VALUE
    ----------------------------------------------------------------
    total mass                 28,800 kg
    SPS specific impulse       314 sec
    SPS propellant (usable)    18,602 kg
    Earth radius               6,371 km
    Earth mass                 5.972e24 kg
    initial orbit altitude     400 km (ISS-like)

---

## Handbook Section Index

    Section 1 .... Spacecraft description, general configuration
    Section 2.1 .. Guidance and Navigation (G&N)
    Section 2.2 .. Guidance and Navigation (continued)
    Section 2.3 .. Stabilization and Control System (SCS) <<<
    Section 2.4 .. Service Propulsion System (SPS) <<<
    Section 2.5 .. Reaction Control System (RCS) <<<
    Section 2.6 .. Electrical Power System (EPS)
    Section 2.7 .. Environmental Control System (ECS)
    Section 2.8 .. Telecommunications
    Section 2.9 .. Sequential Systems
    Section 2.10 . Crew Personal Equipment
    Section 2.11 . Docking and Transfer

    <<< = sections with data extracted into reference docs
