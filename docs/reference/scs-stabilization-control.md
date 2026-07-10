# SCS - Stabilization and Control System

Quick reference extracted from SM2A-03-SC012 Apollo Operations Handbook,
Spacecraft 012, Section 2.3. Basic Date 12 Nov 1966.

## System Overview

    The SCS provides spacecraft attitude control, rate damping,
    and thrust vector control for the SPS engine. It interfaces
    with both the RCS (attitude jets) and SPS (gimbal actuators).

    In the simulator this maps to the SAS (Stability Augmentation
    System) toggled with the T key.

## Attitude Rate Limits

    ORBITAL FLIGHT:
      pitch rate ........... 0.79 deg/sec
      yaw rate ............. 0.79 deg/sec
      roll rate ............ 0.79 deg/sec

    MAXIMUM NON-ENTRY MANEUVER:
      pitch rate ........... 10 deg/sec
      yaw rate ............. 10 deg/sec
      roll rate ............ 10 deg/sec

    ENTRY:
      roll rate ............ up to 20 deg/sec (variable)
      pitch/yaw rate ....... reduced envelope

## Rate Deadbands

    NORMAL MODE:
      all axes ............. 0.2 deg/sec

    ENTRY MODE:
      all axes ............. 2.0 deg/sec

    The rate deadband defines the threshold below which the
    SCS will not fire jets to correct. Within the deadband
    the spacecraft drifts freely.

## Attitude Hold Mode

    ATTITUDE ERROR DEADBAND:
      narrow ............... +/-0.3 deg (typical, all axes)
      wide ................. variable by mode

    When SCS is in attitude hold, it combines:
      1. Rate feedback (rate gyros) for damping
      2. Attitude error (body-mounted attitude gyros, BMAG)
         for position hold

    Jets fire minimum impulse pulses (~18+/-4 ms) to
    maintain attitude within the deadband.

## Minimum Impulse Characteristics

    PULSE WIDTH ............ 18+/-4 ms (14 ms minimum)
    BODY ANGULAR RATE ...... ~3 arc-min/sec per pulse
    JET THRUST ............. 100 lbs (from S/M RCS)

    At 14 ms minimum pulse and 100 lbs thrust:
    Impulse = 100 * 0.014 = 1.4 lb-sec per firing

## Rate Gyro Assembly (RGA)

    Three single-degree-of-freedom rate gyros
    Mounted to the navigation base
    Provides body rate signals for:
      - rate damping (SCS)
      - rate display on FDAI
      - thrust vector control feedback

## Body-Mounted Attitude Gyros (BMAG)

    Two packages (BMAG 1 and BMAG 2)
    Each contains 3 single-DOF gyros
    Provide attitude error signals for:
      - attitude hold
      - attitude reference (backup to IMU)

## Control Modes

    G&N ATTITUDE HOLD:
      IMU provides reference, SCS executes
      Highest accuracy attitude control

    SCS ATTITUDE HOLD:
      BMAG provides reference
      Rate + attitude error to RCS jets

    RATE COMMAND:
      Rotation controller commands rate
      Rate gyros provide feedback
      Release controller => rate damps to zero

    MINIMUM IMPULSE:
      Each rotation controller deflection fires
      one minimum-duration pulse (~18 ms)
      Provides fine attitude adjustment

    FREE (rate damping only):
      No attitude hold
      Rate gyros damp rates below deadband
      Spacecraft attitude drifts

## Thrust Vector Control (SCS Role)

    During SPS burns, the SCS controls the engine gimbal
    to maintain thrust vector through the spacecraft CG.

    SCS DELTA-V MODE:
      Backup to G&N for SPS burns
      Uses DECA (delta-V counter) for burn duration
      Rate + attitude feedback to gimbal actuators

    TVC INPUTS:
      pitch/yaw attitude error
      pitch/yaw body rates
      gimbal position feedback

    TVC OUTPUT:
      commands to SPS gimbal actuators
      (0.23 rad/sec max slew rate)

## Electrical Assemblies

    ECA (Electronic Control Assembly):
      2 units, provides jet selection logic
      and driver signals for RCS solenoids

    DECA (Delta-V/ECA):
      contains delta-V counter
      provides SPS thrust on/off logic

## SCS Control Panels

    Panel 1: FDAI (Flight Director Attitude Indicator)
    Panel 2: FCSM reset/override switches
    Panel 6: gimbal position trim thumbwheels
    Panel 7: direct ullage pushbutton
    Panel 8: SCS mode switches (ATT, RATE, DELTA-V)
    Panel 25: SCS circuit breakers

## Simulator Mapping

    SCS FUNCTION              SIMULATOR EQUIVALENT
    ------------------------------------------------
    SCS attitude hold    -->  SAS ON (T key)
    Rate command         -->  W/S/A/D/Q/E keys
    Rate deadband        -->  0.2 deg/sec threshold
    Max orbital rate     -->  0.79 deg/sec cap
    Minimum impulse      -->  ~18 ms jet pulse
    Free drift           -->  SAS OFF

## Source References

    Section 2.3, SM2A-03-SC012
    Figures: 2.3-1 through 2.3-31
