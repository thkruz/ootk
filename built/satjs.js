"use strict";
/**
 * @author Theodore Kruczek
 * @file Satjs is a 1:1 port of the 2020 version of sgp4unit.cpp from "Fundamentals
 * of Astrodynamics and Applications" by David Vallado.
 * @description All of the original comments and notes are inserted in the code below
 * in order provide context to the functions and clarify any adjustments made for
 * JavaScript compatibility.
 *
 * @copyright
 * MIT License
 *
 * Copyright (c) 2020-2021 Theodore Kruczek
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Satjs = void 0;
/*     ----------------------------------------------------------------
 *
 *                               sgp4unit.cpp
 *
 *    this file contains the sgp4 procedures for analytical propagation
 *    of a satellite. the code was originally released in the 1980 and 1986
 *    spacetrack papers. a detailed discussion of the theory and history
 *    may be found in the 2006 aiaa paper by vallado, crawford, hujsak,
 *    and kelso.
 *
 *                            companion code for
 *               fundamentals of astrodynamics and applications
 *                                    2013
 *                              by david vallado
 *
 *     (w) 719-573-2600, email dvallado@agi.com, davallado@gmail.com
 *
 *    current :
 *              12 mar 20  david vallado
 *                           chg satnum to string for alpha 5 or 9-digit
 *    changes :
 *               7 dec 15  david vallado
 *                           fix jd, jdfrac
 *               3 nov 14  david vallado
 *                           update to msvs2013 c++
 *              30 aug 10  david vallado
 *                           delete unused variables in initl
 *                           replace pow integer 2, 3 with multiplies for speed
 *               3 nov 08  david vallado
 *                           put returns in for error codes
 *              29 sep 08  david vallado
 *                           fix atime for faster operation in dspace
 *                           add operationmode for afspc (a) or improved (i)
 *                           performance mode
 *              16 jun 08  david vallado
 *                           update small eccentricity check
 *              16 nov 07  david vallado
 *                           misc fixes for better compliance
 *              20 apr 07  david vallado
 *                           misc fixes for constants
 *              11 aug 06  david vallado
 *                           chg lyddane choice back to strn3, constants, misc doc
 *              15 dec 05  david vallado
 *                           misc fixes
 *              26 jul 05  david vallado
 *                           fixes for paper
 *                           note that each fix is preceded by a
 *                           comment with "sgp4fix" and an explanation of
 *                           what was changed
 *              10 aug 04  david vallado
 *                           2nd printing baseline working
 *              14 may 01  david vallado
 *                           2nd edition baseline
 *                     80  norad
 *                           original baseline
 *       ----------------------------------------------------------------      */
var PI = Math.PI;
var TAU = PI * 2;
var DEG2RAD = PI / 180.0;
var vkmpersec;
var x2o3 = 2.0 / 3.0;
/////////////////////////////
var xpdotp = 1440.0 / (2.0 * PI); // 229.1831180523293;
var zes = 0.01675;
var zel = 0.0549;
var c1ss = 2.9864797e-6;
var c1l = 4.7968065e-7;
var zsinis = 0.39785416;
var zcosis = 0.91744867;
var zcosgs = 0.1945905;
var zsings = -0.98088458;
var q22 = 1.7891679e-6;
var q31 = 2.1460748e-6;
var q33 = 2.2123015e-7;
var root22 = 1.7891679e-6;
var root44 = 7.3636953e-9;
var root54 = 2.1765803e-9;
var rptim = 4.37526908801129966e-3; // equates to 7.29211514668855e-5 rad/sec
var root32 = 3.7393792e-7;
var root52 = 1.1428639e-7;
var znl = 1.5835218e-4;
var zns = 1.19459e-5;
var temp4 = 1.5e-12;
var fasx2 = 0.13130908;
var fasx4 = 2.8843198;
var fasx6 = 0.37448087;
var g22 = 5.7686396;
var g32 = 0.95240898;
var g44 = 1.8014998;
var g52 = 1.050833;
var g54 = 4.4108898;
var stepp = 720.0;
var stepn = -720.0;
var step2 = 259200.0;
/**
 * Satjs code is run synchronously and often on super tight loops, so lets reuse the variables as much as possible.
 */
// prettier-ignore
var axnl, aynl, xl, u, ktr, ecose, esine, el2, pl, rl, rdotl, rvdotl, betal, sinu, cosu, sin2u, coseo1, sineo1, cosip, sinip, cosisq, delm, delomg, eo1, argpm, argpp, su, t3, t4, tc, tem5, temp, tempa, tempe, templ, inclm, mm, nm, nodem, xincp, xlm, mp, nodep, xmdf, argpdf, nodedf, t2, delmtemp, em, dspaceOptions, dspaceResult, am, ep, cosim, sinim, dpperResult, dpperParameters, method, ts70, ds70, c1, tfrac, thgr70, fk5r, c1p2p, dndt, ft, delt, xndt, xldot, xnddt, x2omi, xomi, x2li, theta, tut1, snodm, cnodm, sinomm, cosomm, betasq, rtemsq, peo, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, cc, x1, x2, x3, x4, x5, x6, x7, x8, zcosg, zsing, zcosh, zsinh, zcosi, zsini, ss1, ss2, ss3, ss4, ss5, ss6, ss7, sz1, sz2, sz3, sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33, s1, s2, s3, s4, s5, s6, s7, z1, z2, z3, z11, z12, z13, z21, z22, z23, z31, z32, z33, f220, f221, f311, f321, f322, f330, f441, f442, f522, f523, f542, f543, g200, g201, g211, g300, g310, g322, g410, g422, g520, g521, g532, g533, sini2, temp1, xno2, ainv2, aonv, cos2u, mrt, temp2, xnode, xinc, mvt, rvdot, sinsu, cossu, snod, cnod, cosi, sini, xmx, xmy, ux, uy, uz, vx, vy, vz, r, v, year, satrec, dsinitResult, dsinitOptions, ao, mon, day, hr, minute, sec, ss, qzms24temp, qzms2ttemp, initlOptions, initlResult, cosio, delmotemp, dscomOptions, dscomResult, dpperOptions, sinio, qzms2t, con42, cosio2, lmonth, dayofyr, inttemp, i, eccsq, omeosq, rteosq, ak, d1, adel, po, ses, sis, sls, sghs, shs, sel, sil, sll, con41, ainv, posq, rp, sghl, shll, PInco, plo, pho, ctem, zcosil, zsinhl, stem, zsingl, zsinil, gam, zy, pgho, zcoshl, xnoi, zcosgl, zmol, zmos, se2, se3, si2, si3, sl2, sl3, sl4, sgh2, xnodce, sh3, sgh4, sh2, ee2, e3, xi2, xi3, xl2, xl3, xl4, sgh3, xgh2, xgh3, xgh4, xh2, xh3, sgs, emo, emsqo, eoc, alfdp, betdp, cosop, sinop, dalf, dbet, dls, f2, f3, pe, pgh, ph, PInc, sinzf, xls, xnoh, zf, zm, cc1sq, cc2, cc3, coef, coef1, cosio4, emsq, eeta, etasq, perige, PInvsq, psisq, qzms24, sfour, temp3, tsi, xPIdot, xhdot1, leadingChar, gsto, lsflg, j2, j3, j3oj2, j4, xke, mus, radiusearthkm, tumin;
var Satjs = /** @class */ (function () {
    function Satjs() {
    }
    /* -----------------------------------------------------------------------------
   *
   *                           procedure dpper
   *
   *  this procedure provides deep space long period periodic contributions
   *    to the mean elements.  by design, these periodics are zero at epoch.
   *    this used to be dscom which included initialization, but it's really a
   *    recurring function.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    e3          -
   *    ee2         -
   *    peo         -
   *    pgho        -
   *    pho         -
   *    PInco       -
   *    plo         -
   *    se2 , se3 , sgh2, sgh3, sgh4, sh2, sh3, si2, si3, sl2, sl3, sl4 -
   *    t           -
   *    xh2, xh3, xi2, xi3, xl2, xl3, xl4 -
   *    zmol        -
   *    zmos        -
   *    ep          - eccentricity                           0.0 - 1.0
   *    inclo       - inclination - needed for lyddane modification
   *    nodep       - right ascension of ascending node
   *    argpp       - argument of perigee
   *    mp          - mean anomaly
   *
   *  outputs       :
   *    ep          - eccentricity                           0.0 - 1.0
   *    inclp       - inclination
   *    nodep        - right ascension of ascending node
   *    argpp       - argument of perigee
   *    mp          - mean anomaly
   *
   *  locals        :
   *    alfdp       -
   *    betdp       -
   *    cosip  , sinip  , cosop  , sinop  ,
   *    dalf        -
   *    dbet        -
   *    dls         -
   *    f2, f3      -
   *    pe          -
   *    pgh         -
   *    ph          -
   *    PInc        -
   *    pl          -
   *    sel   , ses   , sghl  , sghs  , shl   , shs   , sil   , sinzf , sis   ,
   *    sll   , sls
   *    xls         -
   *    xnoh        -
   *    zf          -
   *    zm          -
   *
   *  coupling      :
   *    none.
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.dpper = function (satrec, options) {
        var e3 = satrec.e3, ee2 = satrec.ee2, peo = satrec.peo, pgho = satrec.pgho, pho = satrec.pho, PInco = satrec.PInco, plo = satrec.plo, se2 = satrec.se2, se3 = satrec.se3, sgh2 = satrec.sgh2, sgh3 = satrec.sgh3, sgh4 = satrec.sgh4, sh2 = satrec.sh2, sh3 = satrec.sh3, si2 = satrec.si2, si3 = satrec.si3, sl2 = satrec.sl2, sl3 = satrec.sl3, sl4 = satrec.sl4, t = satrec.t, xgh2 = satrec.xgh2, xgh3 = satrec.xgh3, xgh4 = satrec.xgh4, xh2 = satrec.xh2, xh3 = satrec.xh3, xi2 = satrec.xi2, xi3 = satrec.xi3, xl2 = satrec.xl2, xl3 = satrec.xl3, xl4 = satrec.xl4, zmol = satrec.zmol, zmos = satrec.zmos;
        var ep = options.ep, inclp = options.inclp, nodep = options.nodep, argpp = options.argpp, mp = options.mp;
        var _a = options.opsmode, opsmode = _a === void 0 ? i : _a, init = options.init;
        //  ---------------------- constants -----------------------------
        /** Satjs -- Declared outside the class at the top */
        // zns = 1.19459e-5;
        // zes = 0.01675;
        // znl = 1.5835218e-4;
        // zel = 0.0549;
        //  --------------- calculate time varying periodics -----------
        zm = zmos + zns * t;
        // be sure that the initial call has time set to zero
        if (init === 'y') {
            zm = zmos;
        }
        zf = zm + 2.0 * zes * Math.sin(zm);
        sinzf = Math.sin(zf);
        f2 = 0.5 * sinzf * sinzf - 0.25;
        f3 = -0.5 * sinzf * Math.cos(zf);
        ses = se2 * f2 + se3 * f3;
        sis = si2 * f2 + si3 * f3;
        sls = sl2 * f2 + sl3 * f3 + sl4 * sinzf;
        sghs = sgh2 * f2 + sgh3 * f3 + sgh4 * sinzf;
        shs = sh2 * f2 + sh3 * f3;
        zm = zmol + znl * t;
        if (init === 'y') {
            zm = zmol;
        }
        zf = zm + 2.0 * zel * Math.sin(zm);
        sinzf = Math.sin(zf);
        f2 = 0.5 * sinzf * sinzf - 0.25;
        f3 = -0.5 * sinzf * Math.cos(zf);
        sel = ee2 * f2 + e3 * f3;
        sil = xi2 * f2 + xi3 * f3;
        sll = xl2 * f2 + xl3 * f3 + xl4 * sinzf;
        sghl = xgh2 * f2 + xgh3 * f3 + xgh4 * sinzf;
        shll = xh2 * f2 + xh3 * f3;
        pe = ses + sel;
        PInc = sis + sil;
        pl = sls + sll;
        pgh = sghs + sghl;
        ph = shs + shll;
        if (init === 'n') {
            pe -= peo;
            PInc -= PInco;
            pl -= plo;
            pgh -= pgho;
            ph -= pho;
            inclp += PInc;
            ep += pe;
            sinip = Math.sin(inclp);
            cosip = Math.cos(inclp);
            /* ----------------- apply periodics directly ------------ */
            // sgp4fix for lyddane choice
            // strn3 used original inclination - this is technically feasible
            // gsfc used perturbed inclination - also technically feasible
            // probably best to readjust the 0.2 limit value and limit discontinuity
            // 0.2 rad = 11.45916 deg
            // use next line for original strn3 approach and original inclination
            // if (inclo >= 0.2)
            // use next line for gsfc version and perturbed inclination
            if (inclp >= 0.2) {
                ph /= sinip;
                pgh -= cosip * ph;
                argpp += pgh;
                nodep += ph;
                mp += pl;
            }
            else {
                //  ---- apply periodics with lyddane modification ----
                sinop = Math.sin(nodep);
                cosop = Math.cos(nodep);
                alfdp = sinip * sinop;
                betdp = sinip * cosop;
                dalf = ph * cosop + PInc * cosip * sinop;
                dbet = -ph * sinop + PInc * cosip * cosop;
                alfdp += dalf;
                betdp += dbet;
                nodep %= TAU;
                //  sgp4fix for afspc written intrinsic functions
                //  nodep used without a trigonometric function ahead
                /* istanbul ignore next */
                if (nodep < 0.0 && opsmode === 'a') {
                    nodep += TAU;
                }
                xls = mp + argpp + cosip * nodep;
                dls = pl + pgh - PInc * nodep * sinip;
                xls += dls;
                xnoh = nodep;
                nodep = Math.atan2(alfdp, betdp);
                //  sgp4fix for afspc written intrinsic functions
                //  nodep used without a trigonometric function ahead
                /* istanbul ignore next */
                if (nodep < 0.0 && opsmode === 'a') {
                    nodep += TAU;
                }
                if (Math.abs(xnoh - nodep) > PI) {
                    /* istanbul ignore next */
                    if (nodep < xnoh) {
                        nodep += TAU;
                    }
                    else {
                        nodep -= TAU;
                    }
                }
                mp += pl;
                argpp = xls - mp - cosip * nodep;
            }
        } // if init == 'n'
        return {
            ep: ep,
            inclp: inclp,
            nodep: nodep,
            argpp: argpp,
            mp: mp,
        };
    }; // dpper
    /*-----------------------------------------------------------------------------
   *
   *                           procedure dscom
   *
   *  this procedure provides deep space common items used by both the secular
   *    and periodics subroutines.  input is provided as shown. this routine
   *    used to be called dpper, but the functions inside weren't well organized.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    epoch       -
   *    ep          - eccentricity
   *    argpp       - argument of perigee
   *    tc          -
   *    inclp       - inclination
   *    nodep       - right ascension of ascending node
   *    np          - mean motion
   *
   *  outputs       :
   *    sinim  , cosim  , sinomm , cosomm , snodm  , cnodm
   *    day         -
   *    e3          -
   *    ee2         -
   *    em          - eccentricity
   *    emsq        - eccentricity squared
   *    gam         -
   *    peo         -
   *    pgho        -
   *    pho         -
   *    PInco       -
   *    plo         -
   *    rtemsq      -
   *    se2, se3         -
   *    sgh2, sgh3, sgh4        -
   *    sh2, sh3, si2, si3, sl2, sl3, sl4         -
   *    s1, s2, s3, s4, s5, s6, s7          -
   *    ss1, ss2, ss3, ss4, ss5, ss6, ss7, sz1, sz2, sz3         -
   *    sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33        -
   *    xgh2, xgh3, xgh4, xh2, xh3, xi2, xi3, xl2, xl3, xl4         -
   *    nm          - mean motion
   *    z1, z2, z3, z11, z12, z13, z21, z22, z23, z31, z32, z33         -
   *    zmol        -
   *    zmos        -
   *
   *  locals        :
   *    a1, a2, a3, a4, a5, a6, a7, a8, a9, a10         -
   *    betasq      -
   *    cc          -
   *    ctem, stem        -
   *    x1, x2, x3, x4, x5, x6, x7, x8          -
   *    xnodce      -
   *    xnoi        -
   *    zcosg  , zsing  , zcosgl , zsingl , zcosh  , zsinh  , zcoshl , zsinhl ,
   *    zcosi  , zsini  , zcosil , zsinil ,
   *    zx          -
   *    zy          -
   *
   *  coupling      :
   *    none.
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.dscom = function (options) {
        var epoch = options.epoch, ep = options.ep, argpp = options.argpp, tc = options.tc, inclp = options.inclp, nodep = options.nodep, np = options.np;
        // -------------------------- constants -------------------------
        /** Satjs -- These are declared outside the class at the top of the file */
        // zes = 0.01675;
        // zel = 0.0549;
        // c1ss = 2.9864797e-6;
        // c1l = 4.7968065e-7;
        // zsinis = 0.39785416;
        // zcosis = 0.91744867;
        // zcosgs = 0.1945905;
        // zsings = -0.98088458;
        // TAU = 2.0 * Math.PI;
        //  --------------------- local variables ------------------------
        nm = np;
        em = ep;
        snodm = Math.sin(nodep);
        cnodm = Math.cos(nodep);
        sinomm = Math.sin(argpp);
        cosomm = Math.cos(argpp);
        sinim = Math.sin(inclp);
        cosim = Math.cos(inclp);
        emsq = em * em;
        betasq = 1.0 - emsq;
        rtemsq = Math.sqrt(betasq);
        //  ----------------- initialize lunar solar terms ---------------
        peo = 0.0;
        PInco = 0.0;
        plo = 0.0;
        pgho = 0.0;
        pho = 0.0;
        day = epoch + 18261.5 + tc / 1440.0;
        xnodce = (4.523602 - 9.2422029e-4 * day) % TAU;
        stem = Math.sin(xnodce);
        ctem = Math.cos(xnodce);
        zcosil = 0.91375164 - 0.03568096 * ctem;
        zsinil = Math.sqrt(1.0 - zcosil * zcosil);
        zsinhl = (0.089683511 * stem) / zsinil;
        zcoshl = Math.sqrt(1.0 - zsinhl * zsinhl);
        gam = 5.8351514 + 0.001944368 * day;
        var zx = (0.39785416 * stem) / zsinil;
        zy = zcoshl * ctem + 0.91744867 * zsinhl * stem;
        zx = Math.atan2(zx, zy);
        zx += gam - xnodce;
        zcosgl = Math.cos(zx);
        zsingl = Math.sin(zx);
        //  ------------------------- do solar terms ---------------------
        zcosg = zcosgs;
        zsing = zsings;
        zcosi = zcosis;
        zsini = zsinis;
        zcosh = cnodm;
        zsinh = snodm;
        cc = c1ss;
        xnoi = 1.0 / nm;
        for (lsflg = 1; lsflg <= 2; lsflg++) {
            a1 = zcosg * zcosh + zsing * zcosi * zsinh;
            a3 = -zsing * zcosh + zcosg * zcosi * zsinh;
            a7 = -zcosg * zsinh + zsing * zcosi * zcosh;
            a8 = zsing * zsini;
            a9 = zsing * zsinh + zcosg * zcosi * zcosh;
            a10 = zcosg * zsini;
            a2 = cosim * a7 + sinim * a8;
            a4 = cosim * a9 + sinim * a10;
            a5 = -sinim * a7 + cosim * a8;
            a6 = -sinim * a9 + cosim * a10;
            x1 = a1 * cosomm + a2 * sinomm;
            x2 = a3 * cosomm + a4 * sinomm;
            x3 = -a1 * sinomm + a2 * cosomm;
            x4 = -a3 * sinomm + a4 * cosomm;
            x5 = a5 * sinomm;
            x6 = a6 * sinomm;
            x7 = a5 * cosomm;
            x8 = a6 * cosomm;
            z31 = 12.0 * x1 * x1 - 3.0 * x3 * x3;
            z32 = 24.0 * x1 * x2 - 6.0 * x3 * x4;
            z33 = 12.0 * x2 * x2 - 3.0 * x4 * x4;
            z1 = 3.0 * (a1 * a1 + a2 * a2) + z31 * emsq;
            z2 = 6.0 * (a1 * a3 + a2 * a4) + z32 * emsq;
            z3 = 3.0 * (a3 * a3 + a4 * a4) + z33 * emsq;
            z11 = -6.0 * a1 * a5 + emsq * (-24.0 * x1 * x7 - 6.0 * x3 * x5);
            z12 =
                -6.0 * (a1 * a6 + a3 * a5) +
                    emsq * (-24.0 * (x2 * x7 + x1 * x8) + -6.0 * (x3 * x6 + x4 * x5));
            z13 = -6.0 * a3 * a6 + emsq * (-24.0 * x2 * x8 - 6.0 * x4 * x6);
            z21 = 6.0 * a2 * a5 + emsq * (24.0 * x1 * x5 - 6.0 * x3 * x7);
            z22 =
                6.0 * (a4 * a5 + a2 * a6) + emsq * (24.0 * (x2 * x5 + x1 * x6) - 6.0 * (x4 * x7 + x3 * x8));
            z23 = 6.0 * a4 * a6 + emsq * (24.0 * x2 * x6 - 6.0 * x4 * x8);
            z1 = z1 + z1 + betasq * z31;
            z2 = z2 + z2 + betasq * z32;
            z3 = z3 + z3 + betasq * z33;
            s3 = cc * xnoi;
            s2 = (-0.5 * s3) / rtemsq;
            s4 = s3 * rtemsq;
            s1 = -15.0 * em * s4;
            s5 = x1 * x3 + x2 * x4;
            s6 = x2 * x3 + x1 * x4;
            s7 = x2 * x4 - x1 * x3;
            //  ----------------------- do lunar terms -------------------
            if (lsflg === 1) {
                ss1 = s1;
                ss2 = s2;
                ss3 = s3;
                ss4 = s4;
                ss5 = s5;
                ss6 = s6;
                ss7 = s7;
                sz1 = z1;
                sz2 = z2;
                sz3 = z3;
                sz11 = z11;
                sz12 = z12;
                sz13 = z13;
                sz21 = z21;
                sz22 = z22;
                sz23 = z23;
                sz31 = z31;
                sz32 = z32;
                sz33 = z33;
                zcosg = zcosgl;
                zsing = zsingl;
                zcosi = zcosil;
                zsini = zsinil;
                zcosh = zcoshl * cnodm + zsinhl * snodm;
                zsinh = snodm * zcoshl - cnodm * zsinhl;
                cc = c1l;
            }
        }
        zmol = (4.7199672 + (0.2299715 * day - gam)) % TAU;
        zmos = (6.2565837 + 0.017201977 * day) % TAU;
        //  ------------------------ do solar terms ----------------------
        se2 = 2.0 * ss1 * ss6;
        se3 = 2.0 * ss1 * ss7;
        si2 = 2.0 * ss2 * sz12;
        si3 = 2.0 * ss2 * (sz13 - sz11);
        sl2 = -2.0 * ss3 * sz2;
        sl3 = -2.0 * ss3 * (sz3 - sz1);
        sl4 = -2.0 * ss3 * (-21.0 - 9.0 * emsq) * zes;
        sgh2 = 2.0 * ss4 * sz32;
        sgh3 = 2.0 * ss4 * (sz33 - sz31);
        sgh4 = -18.0 * ss4 * zes;
        sh2 = -2.0 * ss2 * sz22;
        sh3 = -2.0 * ss2 * (sz23 - sz21);
        //  ------------------------ do lunar terms ----------------------
        ee2 = 2.0 * s1 * s6;
        e3 = 2.0 * s1 * s7;
        xi2 = 2.0 * s2 * z12;
        xi3 = 2.0 * s2 * (z13 - z11);
        xl2 = -2.0 * s3 * z2;
        xl3 = -2.0 * s3 * (z3 - z1);
        xl4 = -2.0 * s3 * (-21.0 - 9.0 * emsq) * zel;
        xgh2 = 2.0 * s4 * z32;
        xgh3 = 2.0 * s4 * (z33 - z31);
        xgh4 = -18.0 * s4 * zel;
        xh2 = -2.0 * s2 * z22;
        xh3 = -2.0 * s2 * (z23 - z21);
        return {
            snodm: snodm,
            cnodm: cnodm,
            sinim: sinim,
            cosim: cosim,
            sinomm: sinomm,
            cosomm: cosomm,
            day: day,
            e3: e3,
            ee2: ee2,
            em: em,
            emsq: emsq,
            gam: gam,
            peo: peo,
            pgho: pgho,
            pho: pho,
            PInco: PInco,
            plo: plo,
            rtemsq: rtemsq,
            se2: se2,
            se3: se3,
            sgh2: sgh2,
            sgh3: sgh3,
            sgh4: sgh4,
            sh2: sh2,
            sh3: sh3,
            si2: si2,
            si3: si3,
            sl2: sl2,
            sl3: sl3,
            sl4: sl4,
            s1: s1,
            s2: s2,
            s3: s3,
            s4: s4,
            s5: s5,
            s6: s6,
            s7: s7,
            ss1: ss1,
            ss2: ss2,
            ss3: ss3,
            ss4: ss4,
            ss5: ss5,
            ss6: ss6,
            ss7: ss7,
            sz1: sz1,
            sz2: sz2,
            sz3: sz3,
            sz11: sz11,
            sz12: sz12,
            sz13: sz13,
            sz21: sz21,
            sz22: sz22,
            sz23: sz23,
            sz31: sz31,
            sz32: sz32,
            sz33: sz33,
            xgh2: xgh2,
            xgh3: xgh3,
            xgh4: xgh4,
            xh2: xh2,
            xh3: xh3,
            xi2: xi2,
            xi3: xi3,
            xl2: xl2,
            xl3: xl3,
            xl4: xl4,
            nm: nm,
            z1: z1,
            z2: z2,
            z3: z3,
            z11: z11,
            z12: z12,
            z13: z13,
            z21: z21,
            z22: z22,
            z23: z23,
            z31: z31,
            z32: z32,
            z33: z33,
            zmol: zmol,
            zmos: zmos,
        };
    }; // dscom
    /*-----------------------------------------------------------------------------
   *
   *                           procedure dsinit
   *
   *  this procedure provides deep space contributions to mean motion dot due
   *    to geopotential resonance with half day and one day orbits.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    cosim, sinim-
   *    emsq        - eccentricity squared
   *    argpo       - argument of perigee
   *    s1, s2, s3, s4, s5      -
   *    ss1, ss2, ss3, ss4, ss5 -
   *    sz1, sz3, sz11, sz13, sz21, sz23, sz31, sz33 -
   *    t           - time
   *    tc          -
   *    gsto        - greenwich sidereal time                   rad
   *    mo          - mean anomaly
   *    mdot        - mean anomaly dot (rate)
   *    no          - mean motion
   *    nodeo       - right ascension of ascending node
   *    nodedot     - right ascension of ascending node dot (rate)
   *    xPIdot      -
   *    z1, z3, z11, z13, z21, z23, z31, z33 -
   *    eccm        - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    xn          - mean motion
   *    nodem       - right ascension of ascending node
   *
   *  outputs       :
   *    em          - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    nodem       - right ascension of ascending node
   *    irez        - flag for resonance           0-none, 1-one day, 2-half day
   *    atime       -
   *    d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433    -
   *    dedt        -
   *    didt        -
   *    dmdt        -
   *    dndt        -
   *    dnodt       -
   *    domdt       -
   *    del1, del2, del3        -
   *    ses  , sghl , sghs , sgs  , shl  , shs  , sis  , sls
   *    theta       -
   *    xfact       -
   *    xlamo       -
   *    xli         -
   *    xni
   *
   *  locals        :
   *    ainv2       -
   *    aonv        -
   *    cosisq      -
   *    eoc         -
   *    f220, f221, f311, f321, f322, f330, f441, f442, f522, f523, f542, f543  -
   *    g200, g201, g211, g300, g310, g322, g410, g422, g520, g521, g532, g533  -
   *    sini2       -
   *    temp        -
   *    temp1       -
   *    theta       -
   *    xno2        -
   *
   *  coupling      :
   *    getgravconst
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.dsinit = function (options) {
        var 
        // sgp4fix just send in xke as a constant and eliminate getgravconst call
        // gravconsttype whichconst,
        xke = options.xke, cosim = options.cosim, argpo = options.argpo, s1 = options.s1, s2 = options.s2, s3 = options.s3, s4 = options.s4, s5 = options.s5, sinim = options.sinim, ss1 = options.ss1, ss2 = options.ss2, ss3 = options.ss3, ss4 = options.ss4, ss5 = options.ss5, sz1 = options.sz1, sz3 = options.sz3, sz11 = options.sz11, sz13 = options.sz13, sz21 = options.sz21, sz23 = options.sz23, sz31 = options.sz31, sz33 = options.sz33, t = options.t, tc = options.tc, gsto = options.gsto, mo = options.mo, mdot = options.mdot, no = options.no, nodeo = options.nodeo, nodedot = options.nodedot, xPIdot = options.xPIdot, z1 = options.z1, z3 = options.z3, z11 = options.z11, z13 = options.z13, z21 = options.z21, z23 = options.z23, z31 = options.z31, z33 = options.z33, ecco = options.ecco, eccsq = options.eccsq;
        var emsq = options.emsq, em = options.em, argpm = options.argpm, inclm = options.inclm, mm = options.mm, nm = options.nm, nodem = options.nodem, irez = options.irez, atime = options.atime, d2201 = options.d2201, d2211 = options.d2211, d3210 = options.d3210, d3222 = options.d3222, d4410 = options.d4410, d4422 = options.d4422, d5220 = options.d5220, d5232 = options.d5232, d5421 = options.d5421, d5433 = options.d5433, dedt = options.dedt, didt = options.didt, dmdt = options.dmdt, dnodt = options.dnodt, domdt = options.domdt, del1 = options.del1, del2 = options.del2, del3 = options.del3, xfact = options.xfact, xlamo = options.xlamo, xli = options.xli, xni = options.xni;
        /* --------------------- local variables ------------------------ */
        /** Satjs -- these are declared at the top instead */
        // q22 = 1.7891679e-6;
        // q31 = 2.1460748e-6;
        // q33 = 2.2123015e-7;
        // root22 = 1.7891679e-6;
        // root44 = 7.3636953e-9;
        // root54 = 2.1765803e-9;
        // rptim = 4.37526908801129966e-3; // equates to 7.29211514668855e-5 rad/sec
        // root32 = 3.7393792e-7;
        // root52 = 1.1428639e-7;
        // x2o3 = 2.0 / 3.0;
        // znl = 1.5835218e-4;
        // zns = 1.19459e-5;
        // sgp4fix identify constants and allow alternate values
        // just xke is used here so pass it in rather than have multiple calls
        // getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
        // -------------------- deep space initialization ------------
        irez = 0;
        if (nm < 0.0052359877 && nm > 0.0034906585) {
            irez = 1;
        }
        if (nm >= 8.26e-3 && nm <= 9.24e-3 && em >= 0.5) {
            irez = 2;
        }
        // ------------------------ do solar terms -------------------
        ses = ss1 * zns * ss5;
        sis = ss2 * zns * (sz11 + sz13);
        sls = -zns * ss3 * (sz1 + sz3 - 14.0 - 6.0 * emsq);
        sghs = ss4 * zns * (sz31 + sz33 - 6.0);
        var shs = -zns * ss2 * (sz21 + sz23);
        // sgp4fix for 180 deg incl
        if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) {
            shs = 0.0;
        }
        if (sinim !== 0.0) {
            shs /= sinim;
        }
        sgs = sghs - cosim * shs;
        // ------------------------- do lunar terms ------------------
        dedt = ses + s1 * znl * s5;
        didt = sis + s2 * znl * (z11 + z13);
        dmdt = sls - znl * s3 * (z1 + z3 - 14.0 - 6.0 * emsq);
        sghl = s4 * znl * (z31 + z33 - 6.0);
        var shll = -znl * s2 * (z21 + z23);
        // sgp4fix for 180 deg incl
        if (inclm < 5.2359877e-2 || inclm > PI - 5.2359877e-2) {
            shll = 0.0;
        }
        domdt = sgs + sghl;
        dnodt = shs;
        if (sinim !== 0.0) {
            domdt -= (cosim / sinim) * shll;
            dnodt += shll / sinim;
        }
        // ----------- calculate deep space resonance effects --------
        dndt = 0.0;
        theta = (gsto + tc * rptim) % TAU;
        em += dedt * t;
        inclm += didt * t;
        argpm += domdt * t;
        nodem += dnodt * t;
        mm += dmdt * t;
        // sgp4fix for negative inclinations
        // the following if statement should be commented out
        // if (inclm < 0.0)
        // {
        //   inclm  = -inclm;
        //   argpm  = argpm - PI;
        //   nodem = nodem + PI;
        // }
        // -------------- initialize the resonance terms -------------
        if (irez !== 0) {
            aonv = Math.pow((nm / xke), x2o3);
            // ---------- geopotential resonance for 12 hour orbits ------
            if (irez === 2) {
                cosisq = cosim * cosim;
                emo = em;
                em = ecco;
                emsqo = emsq;
                emsq = eccsq;
                eoc = em * emsq;
                g201 = -0.306 - (em - 0.64) * 0.44;
                if (em <= 0.65) {
                    g211 = 3.616 - 13.247 * em + 16.29 * emsq;
                    g310 = -19.302 + 117.39 * em - 228.419 * emsq + 156.591 * eoc;
                    g322 = -18.9068 + 109.7927 * em - 214.6334 * emsq + 146.5816 * eoc;
                    g410 = -41.122 + 242.694 * em - 471.094 * emsq + 313.953 * eoc;
                    g422 = -146.407 + 841.88 * em - 1629.014 * emsq + 1083.435 * eoc;
                    g520 = -532.114 + 3017.977 * em - 5740.032 * emsq + 3708.276 * eoc;
                }
                else {
                    g211 = -72.099 + 331.819 * em - 508.738 * emsq + 266.724 * eoc;
                    g310 = -346.844 + 1582.851 * em - 2415.925 * emsq + 1246.113 * eoc;
                    g322 = -342.585 + 1554.908 * em - 2366.899 * emsq + 1215.972 * eoc;
                    g410 = -1052.797 + 4758.686 * em - 7193.992 * emsq + 3651.957 * eoc;
                    g422 = -3581.69 + 16178.11 * em - 24462.77 * emsq + 12422.52 * eoc;
                    if (em > 0.715) {
                        g520 = -5149.66 + 29936.92 * em - 54087.36 * emsq + 31324.56 * eoc;
                    }
                    else {
                        g520 = 1464.74 - 4664.75 * em + 3763.64 * emsq;
                    }
                }
                if (em < 0.7) {
                    g533 = -919.2277 + 4988.61 * em - 9064.77 * emsq + 5542.21 * eoc;
                    g521 = -822.71072 + 4568.6173 * em - 8491.4146 * emsq + 5337.524 * eoc;
                    g532 = -853.666 + 4690.25 * em - 8624.77 * emsq + 5341.4 * eoc;
                }
                else {
                    g533 = -37995.78 + 161616.52 * em - 229838.2 * emsq + 109377.94 * eoc;
                    g521 = -51752.104 + 218913.95 * em - 309468.16 * emsq + 146349.42 * eoc;
                    g532 = -40023.88 + 170470.89 * em - 242699.48 * emsq + 115605.82 * eoc;
                }
                sini2 = sinim * sinim;
                f220 = 0.75 * (1.0 + 2.0 * cosim + cosisq);
                f221 = 1.5 * sini2;
                f321 = 1.875 * sinim * (1.0 - 2.0 * cosim - 3.0 * cosisq);
                f322 = -1.875 * sinim * (1.0 + 2.0 * cosim - 3.0 * cosisq);
                f441 = 35.0 * sini2 * f220;
                f442 = 39.375 * sini2 * sini2;
                f522 =
                    9.84375 *
                        sinim *
                        (sini2 * (1.0 - 2.0 * cosim - 5.0 * cosisq) +
                            0.33333333 * (-2.0 + 4.0 * cosim + 6.0 * cosisq));
                f523 =
                    sinim *
                        (4.92187512 * sini2 * (-2.0 - 4.0 * cosim + 10.0 * cosisq) +
                            6.56250012 * (1.0 + 2.0 * cosim - 3.0 * cosisq));
                f542 =
                    29.53125 * sinim * (2.0 - 8.0 * cosim + cosisq * (-12.0 + 8.0 * cosim + 10.0 * cosisq));
                f543 =
                    29.53125 * sinim * (-2.0 - 8.0 * cosim + cosisq * (12.0 + 8.0 * cosim - 10.0 * cosisq));
                xno2 = nm * nm;
                ainv2 = aonv * aonv;
                temp1 = 3.0 * xno2 * ainv2;
                temp = temp1 * root22;
                d2201 = temp * f220 * g201;
                d2211 = temp * f221 * g211;
                temp1 *= aonv;
                temp = temp1 * root32;
                d3210 = temp * f321 * g310;
                d3222 = temp * f322 * g322;
                temp1 *= aonv;
                temp = 2.0 * temp1 * root44;
                d4410 = temp * f441 * g410;
                d4422 = temp * f442 * g422;
                temp1 *= aonv;
                temp = temp1 * root52;
                d5220 = temp * f522 * g520;
                d5232 = temp * f523 * g532;
                temp = 2.0 * temp1 * root54;
                d5421 = temp * f542 * g521;
                d5433 = temp * f543 * g533;
                xlamo = (mo + nodeo + nodeo - (theta + theta)) % TAU;
                xfact = mdot + dmdt + 2.0 * (nodedot + dnodt - rptim) - no;
                em = emo;
                emsq = emsqo;
            }
            //  ---------------- synchronous resonance terms --------------
            if (irez === 1) {
                g200 = 1.0 + emsq * (-2.5 + 0.8125 * emsq);
                g310 = 1.0 + 2.0 * emsq;
                g300 = 1.0 + emsq * (-6.0 + 6.60937 * emsq);
                f220 = 0.75 * (1.0 + cosim) * (1.0 + cosim);
                f311 = 0.9375 * sinim * sinim * (1.0 + 3.0 * cosim) - 0.75 * (1.0 + cosim);
                f330 = 1.0 + cosim;
                f330 *= 1.875 * f330 * f330;
                del1 = 3.0 * nm * nm * aonv * aonv;
                del2 = 2.0 * del1 * f220 * g200 * q22;
                del3 = 3.0 * del1 * f330 * g300 * q33 * aonv;
                del1 = del1 * f311 * g310 * q31 * aonv;
                xlamo = (mo + nodeo + argpo - theta) % TAU;
                xfact = mdot + xPIdot + dmdt + domdt + dnodt - (no + rptim);
            }
            //  ------------ for sgp4, initialize the integrator ----------
            xli = xlamo;
            xni = no;
            atime = 0.0;
            nm = no + dndt;
        }
        return {
            em: em,
            argpm: argpm,
            inclm: inclm,
            mm: mm,
            nm: nm,
            nodem: nodem,
            irez: irez,
            atime: atime,
            d2201: d2201,
            d2211: d2211,
            d3210: d3210,
            d3222: d3222,
            d4410: d4410,
            d4422: d4422,
            d5220: d5220,
            d5232: d5232,
            d5421: d5421,
            d5433: d5433,
            dedt: dedt,
            didt: didt,
            dmdt: dmdt,
            dndt: dndt,
            dnodt: dnodt,
            domdt: domdt,
            del1: del1,
            del2: del2,
            del3: del3,
            xfact: xfact,
            xlamo: xlamo,
            xli: xli,
            xni: xni,
        };
    }; // dsinit
    /*-----------------------------------------------------------------------------
   *
   *                           procedure dspace
   *
   *  this procedure provides deep space contributions to mean elements for
   *    perturbing third body.  these effects have been averaged over one
   *    revolution of the sun and moon.  for earth resonance effects, the
   *    effects have been averaged over no revolutions of the satellite.
   *    (mean motion)
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    d2201, d2211, d3210, d3222, d4410, d4422, d5220, d5232, d5421, d5433 -
   *    dedt        -
   *    del1, del2, del3  -
   *    didt        -
   *    dmdt        -
   *    dnodt       -
   *    domdt       -
   *    irez        - flag for resonance           0-none, 1-one day, 2-half day
   *    argpo       - argument of perigee
   *    argpdot     - argument of perigee dot (rate)
   *    t           - time
   *    tc          -
   *    gsto        - gst
   *    xfact       -
   *    xlamo       -
   *    no          - mean motion
   *    atime       -
   *    em          - eccentricity
   *    ft          -
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    xli         -
   *    mm          - mean anomaly
   *    xni         - mean motion
   *    nodem       - right ascension of ascending node
   *
   *  outputs       :
   *    atime       -
   *    em          - eccentricity
   *    argpm       - argument of perigee
   *    inclm       - inclination
   *    xli         -
   *    mm          - mean anomaly
   *    xni         -
   *    nodem       - right ascension of ascending node
   *    dndt        -
   *    nm          - mean motion
   *
   *  locals        :
   *    delt        -
   *    ft          -
   *    theta       -
   *    x2li        -
   *    x2omi       -
   *    xl          -
   *    xldot       -
   *    xnddt       -
   *    xndt        -
   *    xomi        -
   *
   *  coupling      :
   *    none        -
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.dspace = function (options) {
        var irez = options.irez, d2201 = options.d2201, d2211 = options.d2211, d3210 = options.d3210, d3222 = options.d3222, d4410 = options.d4410, d4422 = options.d4422, d5220 = options.d5220, d5232 = options.d5232, d5421 = options.d5421, d5433 = options.d5433, dedt = options.dedt, del1 = options.del1, del2 = options.del2, del3 = options.del3, didt = options.didt, dmdt = options.dmdt, dnodt = options.dnodt, domdt = options.domdt, argpo = options.argpo, argpdot = options.argpdot, t = options.t, tc = options.tc, gsto = options.gsto, xfact = options.xfact, xlamo = options.xlamo, no = options.no;
        var atime = options.atime, em = options.em, argpm = options.argpm, inclm = options.inclm, xli = options.xli, mm = options.mm, xni = options.xni, nodem = options.nodem, nm = options.nm;
        /** Satjs -- Declared at the top of the file instead */
        // fasx2 = 0.13130908;
        // fasx4 = 2.8843198;
        // fasx6 = 0.37448087;
        // g22 = 5.7686396;
        // g32 = 0.95240898;
        // g44 = 1.8014998;
        // g52 = 1.050833;
        // g54 = 4.4108898;
        // rptim = 4.37526908801129966e-3; // equates to 7.29211514668855e-5 rad/sec
        // stepp = 720.0;
        // stepn = -720.0;
        // step2 = 259200.0;
        //  ----------- calculate deep space resonance effects -----------
        dndt = 0.0;
        theta = (gsto + tc * rptim) % TAU;
        em += dedt * t;
        inclm += didt * t;
        argpm += domdt * t;
        nodem += dnodt * t;
        mm += dmdt * t;
        // sgp4fix for negative inclinations
        // the following if statement should be commented out
        // if (inclm < 0.0)
        // {
        //   inclm = -inclm;
        //   argpm = argpm - PI;
        //   nodem = nodem + PI;
        // }
        /* - update resonances : numerical (euler-maclaurin) integration - */
        /* ------------------------- epoch restart ----------------------  */
        //   sgp4fix for propagator problems
        //   the following integration works for negative time steps and periods
        //   the specific changes are unknown because the original code was so convoluted
        // sgp4fix take out atime = 0.0 and fix for faster operation
        // ft = 0.0; /** Satjs -- This has no value */
        if (irez !== 0) {
            //  sgp4fix streamline check
            if (atime === 0.0 || t * atime <= 0.0 || Math.abs(t) < Math.abs(atime)) {
                atime = 0.0;
                xni = no;
                xli = xlamo;
            }
            // sgp4fix move check outside loop
            if (t > 0.0) {
                delt = stepp;
            }
            else {
                delt = stepn;
            }
            var iretn = 381; // added for do loop
            while (iretn === 381) {
                //  ------------------- dot terms calculated -------------
                //  ----------- near - synchronous resonance terms -------
                if (irez !== 2) {
                    xndt =
                        del1 * Math.sin(xli - fasx2) +
                            del2 * Math.sin(2.0 * (xli - fasx4)) +
                            del3 * Math.sin(3.0 * (xli - fasx6));
                    xldot = xni + xfact;
                    xnddt =
                        del1 * Math.cos(xli - fasx2) +
                            2.0 * del2 * Math.cos(2.0 * (xli - fasx4)) +
                            3.0 * del3 * Math.cos(3.0 * (xli - fasx6));
                    xnddt *= xldot;
                }
                else {
                    // --------- near - half-day resonance terms --------
                    xomi = argpo + argpdot * atime;
                    x2omi = xomi + xomi;
                    x2li = xli + xli;
                    xndt =
                        d2201 * Math.sin(x2omi + xli - g22) +
                            d2211 * Math.sin(xli - g22) +
                            d3210 * Math.sin(xomi + xli - g32) +
                            d3222 * Math.sin(-xomi + xli - g32) +
                            d4410 * Math.sin(x2omi + x2li - g44) +
                            d4422 * Math.sin(x2li - g44) +
                            d5220 * Math.sin(xomi + xli - g52) +
                            d5232 * Math.sin(-xomi + xli - g52) +
                            d5421 * Math.sin(xomi + x2li - g54) +
                            d5433 * Math.sin(-xomi + x2li - g54);
                    xldot = xni + xfact;
                    xnddt =
                        d2201 * Math.cos(x2omi + xli - g22) +
                            d2211 * Math.cos(xli - g22) +
                            d3210 * Math.cos(xomi + xli - g32) +
                            d3222 * Math.cos(-xomi + xli - g32) +
                            d5220 * Math.cos(xomi + xli - g52) +
                            d5232 * Math.cos(-xomi + xli - g52) +
                            2.0 * d4410 * Math.cos(x2omi + x2li - g44) +
                            d4422 * Math.cos(x2li - g44) +
                            d5421 * Math.cos(xomi + x2li - g54) +
                            d5433 * Math.cos(-xomi + x2li - g54);
                    xnddt *= xldot;
                }
                //  ----------------------- integrator -------------------
                //  sgp4fix move end checks to end of routine
                if (Math.abs(t - atime) >= stepp) {
                    // iret = 0; /** Satjs -- This has no value */
                    iretn = 381;
                }
                else {
                    ft = t - atime;
                    iretn = 0;
                }
                if (iretn === 381) {
                    xli += xldot * delt + xndt * step2;
                    xni += xndt * delt + xnddt * step2;
                    atime += delt;
                }
            } // while iretn = 381
            nm = xni + xndt * ft + xnddt * ft * ft * 0.5;
            xl = xli + xldot * ft + xndt * ft * ft * 0.5;
            if (irez !== 1) {
                mm = xl - 2.0 * nodem + 2.0 * theta;
                dndt = nm - no;
            }
            else {
                mm = xl - nodem - argpm + theta;
                dndt = nm - no;
            }
            nm = no + dndt;
        }
        return {
            atime: atime,
            em: em,
            argpm: argpm,
            inclm: inclm,
            xli: xli,
            mm: mm,
            xni: xni,
            nodem: nodem,
            dndt: dndt,
            nm: nm,
        };
    }; // dspace
    /*-----------------------------------------------------------------------------
   *
   *                           procedure initl
   *
   *  this procedure initializes the sgp4 propagator. all the initialization is
   *    consolidated here instead of having multiple loops inside other routines.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    satn        - satellite number - not needed, placed in satrec
   *    xke         - reciprocal of tumin
   *    j2          - j2 zonal harmonic
   *    ecco        - eccentricity                           0.0 - 1.0
   *    epoch       - epoch time in days from jan 0, 1950. 0 hr
   *    inclo       - inclination of satellite
   *    no          - mean motion of satellite
   *
   *  outputs       :
   *    ainv        - 1.0 / a
   *    ao          - semi major axis
   *    con41       -
   *    con42       - 1.0 - 5.0 cos(i)
   *    cosio       - cosine of inclination
   *    cosio2      - cosio squared
   *    eccsq       - eccentricity squared
   *    method      - flag for deep space                    'd', 'n'
   *    omeosq      - 1.0 - ecco * ecco
   *    posq        - semi-parameter squared
   *    rp          - radius of perigee
   *    rteosq      - square root of (1.0 - ecco*ecco)
   *    sinio       - sine of inclination
   *    gsto        - gst at time of observation               rad
   *    no          - mean motion of satellite
   *
   *  locals        :
   *    ak          -
   *    d1          -
   *    del         -
   *    adel        -
   *    po          -
   *
   *  coupling      :
   *    getgravconst- no longer used
   *    gstime      - find greenwich sidereal time from the julian date
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.initl = function (options) {
        // sgp4fix satn not needed. include in satrec in case needed later
        // int satn,
        // sgp4fix just pass in xke and j2
        // gravconsttype whichconst,
        var opsmode = options.opsmode, ecco = options.ecco, epoch = options.epoch, inclo = options.inclo, xke = options.xke, j2 = options.j2;
        var no = options.no;
        /* --------------------- local variables ------------------------ */
        /** Satjs -- Declared at the top of the file */
        // sgp4fix use old way of finding gst
        /** Satjs -- Declared at the top of the file */
        // ----------------------- earth constants ---------------------
        // sgp4fix identify constants and allow alternate values
        // only xke and j2 are used here so pass them in directly
        // getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 )
        // ------------- calculate auxillary epoch quantities ----------
        eccsq = ecco * ecco;
        omeosq = 1.0 - eccsq;
        rteosq = Math.sqrt(omeosq);
        cosio = Math.cos(inclo);
        cosio2 = cosio * cosio;
        // ------------------ un-kozai the mean motion -----------------
        ak = Math.pow((xke / no), x2o3);
        d1 = (0.75 * j2 * (3.0 * cosio2 - 1.0)) / (rteosq * omeosq);
        var delPrime = d1 / (ak * ak);
        adel =
            ak *
                (1.0 - delPrime * delPrime - delPrime * (1.0 / 3.0 + (134.0 * delPrime * delPrime) / 81.0));
        delPrime = d1 / (adel * adel);
        no = no / (1.0 + delPrime);
        ao = Math.pow((xke / no), x2o3);
        sinio = Math.sin(inclo);
        po = ao * omeosq;
        con42 = 1.0 - 5.0 * cosio2;
        con41 = -con42 - cosio2 - cosio2;
        ainv = 1.0 / ao;
        posq = po * po;
        rp = ao * (1.0 - ecco);
        method = 'n';
        //  sgp4fix modern approach to finding sidereal time
        /** Satjs -- Continue allowing AFSPC mode for SGP4 Validation */
        if (opsmode == 'a') {
            //  sgp4fix use old way of finding gst
            //  count integer number of days from 0 jan 1970
            ts70 = epoch - 7305.0;
            ds70 = Math.floor(ts70 + 1.0e-8);
            tfrac = ts70 - ds70;
            //  find greenwich location at epoch
            c1 = 1.72027916940703639e-2;
            thgr70 = 1.7321343856509374;
            fk5r = 5.07551419432269442e-15;
            c1p2p = c1 + TAU;
            gsto = (thgr70 + c1 * ds70 + c1p2p * tfrac + ts70 * ts70 * fk5r) % TAU;
            /* istanbul ignore next | This is no longer possible*/
            if (gsto < 0.0) {
                gsto += TAU;
            }
        }
        else {
            gsto = Satjs.gstime(epoch + 2433281.5);
        }
        return {
            no: no,
            method: method,
            ainv: ainv,
            ao: ao,
            con41: con41,
            con42: con42,
            cosio: cosio,
            cosio2: cosio2,
            eccsq: eccsq,
            omeosq: omeosq,
            posq: posq,
            rp: rp,
            rteosq: rteosq,
            sinio: sinio,
            gsto: gsto,
        };
    }; // initl
    /*-----------------------------------------------------------------------------
   *
   *                             procedure sgp4init
   *
   *  this procedure initializes variables for sgp4.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    opsmode     - mode of operation afspc or improved 'a', 'i'
   *    whichconst  - which set of constants to use  72, 84
   *    satn        - satellite number
   *    bstar       - sgp4 type drag coefficient              kg/m2er
   *    ecco        - eccentricity
   *    epoch       - epoch time in days from jan 0, 1950. 0 hr
   *    argpo       - argument of perigee (output if ds)
   *    inclo       - inclination
   *    mo          - mean anomaly (output if ds)
   *    no          - mean motion
   *    nodeo       - right ascension of ascending node
   *
   *  outputs       :
   *    rec      - common values for subsequent calls
   *    return code - non-zero on error.
   *                   1 - mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er
   *                   2 - mean motion less than 0.0
   *                   3 - pert elements, ecc < 0.0  or  ecc > 1.0
   *                   4 - semi-latus rectum < 0.0
   *                   5 - epoch elements are sub-orbital
   *                   6 - satellite has decayed
   *
   *  locals        :
   *    cnodm  , snodm  , cosim  , sinim  , cosomm , sinomm
   *    cc1sq  , cc2    , cc3
   *    coef   , coef1
   *    cosio4      -
   *    day         -
   *    dndt        -
   *    em          - eccentricity
   *    emsq        - eccentricity squared
   *    eeta        -
   *    etasq       -
   *    gam         -
   *    argpm       - argument of perigee
   *    nodem       -
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    perige      - perigee
   *    PInvsq      -
   *    psisq       -
   *    qzms24      -
   *    rtemsq      -
   *    s1, s2, s3, s4, s5, s6, s7          -
   *    sfour       -
   *    ss1, ss2, ss3, ss4, ss5, ss6, ss7         -
   *    sz1, sz2, sz3
   *    sz11, sz12, sz13, sz21, sz22, sz23, sz31, sz32, sz33        -
   *    tc          -
   *    temp        -
   *    temp1, temp2, temp3       -
   *    tsi         -
   *    xPIdot      -
   *    xhdot1      -
   *    z1, z2, z3          -
   *    z11, z12, z13, z21, z22, z23, z31, z32, z33         -
   *
   *  coupling      :
   *    getgravconst-
   *    initl       -
   *    dscom       -
   *    dpper       -
   *    dsinit      -
   *    sgp4        -
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report #3 1980
   *    hoots, norad spacetrack report #6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.sgp4init = function (satrec, options) {
        /* eslint-disable no-param-reassign */
        var _a = options.whichconst, whichconst = _a === void 0 ? 'wgs72' : _a, _b = options.opsmode, opsmode = _b === void 0 ? i : _b, _c = options.satn, satn = _c === void 0 ? satrec.satnum : _c, epoch = options.epoch, xbstar = options.xbstar, xecco = options.xecco, xargpo = options.xargpo, xinclo = options.xinclo, xndot = options.xndot, xnddot = options.xnddot, xmo = options.xmo, xno = options.xno, xnodeo = options.xnodeo;
        /* --------------------- local variables ------------------------ */
        /** Satjs -- Declared at the top of the file */
        /* ------------------------ initialization --------------------- */
        // sgp4fix divisor for divide by zero check on inclination
        // the old check used 1.0 + Math.cos(PI-1.0e-9), but then compared it to
        // 1.5 e-12, so the threshold was changed to 1.5e-12 for consistency
        // temp4 = 1.5e-12;
        // ----------- set all near earth variables to zero ------------
        satrec.isimp = 0;
        satrec.method = 'n';
        satrec.aycof = 0.0;
        satrec.con41 = 0.0;
        satrec.cc1 = 0.0;
        satrec.cc4 = 0.0;
        satrec.cc5 = 0.0;
        satrec.d2 = 0.0;
        satrec.d3 = 0.0;
        satrec.d4 = 0.0;
        satrec.delmo = 0.0;
        satrec.eta = 0.0;
        satrec.argpdot = 0.0;
        satrec.omgcof = 0.0;
        satrec.sinmao = 0.0;
        satrec.t = 0.0;
        satrec.t2cof = 0.0;
        satrec.t3cof = 0.0;
        satrec.t4cof = 0.0;
        satrec.t5cof = 0.0;
        satrec.x1mth2 = 0.0;
        satrec.x7thm1 = 0.0;
        satrec.mdot = 0.0;
        satrec.nodedot = 0.0;
        satrec.xlcof = 0.0;
        satrec.xmcof = 0.0;
        satrec.nodecf = 0.0;
        // ----------- set all deep space variables to zero ------------
        satrec.irez = 0;
        satrec.d2201 = 0.0;
        satrec.d2211 = 0.0;
        satrec.d3210 = 0.0;
        satrec.d3222 = 0.0;
        satrec.d4410 = 0.0;
        satrec.d4422 = 0.0;
        satrec.d5220 = 0.0;
        satrec.d5232 = 0.0;
        satrec.d5421 = 0.0;
        satrec.d5433 = 0.0;
        satrec.dedt = 0.0;
        satrec.del1 = 0.0;
        satrec.del2 = 0.0;
        satrec.del3 = 0.0;
        satrec.didt = 0.0;
        satrec.dmdt = 0.0;
        satrec.dnodt = 0.0;
        satrec.domdt = 0.0;
        satrec.e3 = 0.0;
        satrec.ee2 = 0.0;
        satrec.peo = 0.0;
        satrec.pgho = 0.0;
        satrec.pho = 0.0;
        satrec.PInco = 0.0;
        satrec.plo = 0.0;
        satrec.se2 = 0.0;
        satrec.se3 = 0.0;
        satrec.sgh2 = 0.0;
        satrec.sgh3 = 0.0;
        satrec.sgh4 = 0.0;
        satrec.sh2 = 0.0;
        satrec.sh3 = 0.0;
        satrec.si2 = 0.0;
        satrec.si3 = 0.0;
        satrec.sl2 = 0.0;
        satrec.sl3 = 0.0;
        satrec.sl4 = 0.0;
        satrec.gsto = 0.0;
        satrec.xfact = 0.0;
        satrec.xgh2 = 0.0;
        satrec.xgh3 = 0.0;
        satrec.xgh4 = 0.0;
        satrec.xh2 = 0.0;
        satrec.xh3 = 0.0;
        satrec.xi2 = 0.0;
        satrec.xi3 = 0.0;
        satrec.xl2 = 0.0;
        satrec.xl3 = 0.0;
        satrec.xl4 = 0.0;
        satrec.xlamo = 0.0;
        satrec.zmol = 0.0;
        satrec.zmos = 0.0;
        satrec.atime = 0.0;
        satrec.xli = 0.0;
        satrec.xni = 0.0;
        /* ------------------------ earth constants ----------------------- */
        // sgp4fix identify constants and allow alternate values
        // this is now the only call for the constants
        var gravResults = Satjs.getgravconst(whichconst);
        satrec.tumin = gravResults.tumin;
        satrec.mus = gravResults.mus;
        satrec.radiusearthkm = gravResults.radiusearthkm;
        satrec.xke = gravResults.xke;
        satrec.j2 = gravResults.j2;
        satrec.j3 = gravResults.j3;
        satrec.j4 = gravResults.j4;
        satrec.j3oj2 = gravResults.j3oj2;
        //-------------------------------------------------------------------------
        satrec.error = 0;
        satrec.operationmode = opsmode;
        // new alpha5 or 9-digit number
        /** Satjs -- Using JS code for string manipulation but same effect
         * Ex. A2525 = 102525
         * Ex. Z1234 = 351234
         */
        leadingChar = satn.split('')[0].toLowerCase(); // Using uppercase will break the -96 math.
        if (isNaN(leadingChar)) {
            satrec.satnum = parseInt(leadingChar.charCodeAt(0) - 96 + 9 + satrec.satnum.slice(1, 5)).toString();
        }
        else {
            satrec.satnum = satn;
        }
        // sgp4fix - note the following variables are also passed directly via satrec.
        // it is possible to streamline the sgp4init call by deleting the "x"
        // variables, but the user would need to set the satrec.* values first. we
        // include the additional assignments in case twoline2rv is not used.
        satrec.bstar = xbstar;
        // sgp4fix allow additional parameters in the struct
        satrec.ndot = xndot;
        satrec.nddot = xnddot;
        satrec.ecco = xecco;
        satrec.argpo = xargpo;
        satrec.inclo = xinclo;
        satrec.mo = xmo;
        // sgp4fix rename variables to clarify which mean motion is intended
        satrec.no = xno;
        satrec.nodeo = xnodeo;
        // single averaged mean elements
        // satrec.am = satrec.em = satrec.im = satrec.Om = satrec.mm = satrec.nm = 0.0;
        // ------------------------ earth constants -----------------------
        // sgp4fix identify constants and allow alternate values
        // getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
        ss = 78.0 / satrec.radiusearthkm + 1.0;
        // sgp4fix use multiply for speed instead of pow
        qzms2ttemp = (120.0 - 78.0) / satrec.radiusearthkm;
        qzms2t = qzms2ttemp * qzms2ttemp * qzms2ttemp * qzms2ttemp;
        satrec.init = 'y';
        satrec.t = 0.0;
        // sgp4fix remove satn as it is not needed in initl
        initlOptions = {
            ecco: satrec.ecco,
            epoch: epoch,
            inclo: satrec.inclo,
            no: satrec.no,
            method: satrec.method,
            opsmode: satrec.operationmode,
            xke: satrec.xke,
            j2: satrec.j2,
        };
        initlResult = Satjs.initl(initlOptions);
        var ao = initlResult.ao, con42 = initlResult.con42, cosio = initlResult.cosio, cosio2 = initlResult.cosio2, eccsq = initlResult.eccsq, omeosq = initlResult.omeosq, posq = initlResult.posq, rp = initlResult.rp, rteosq = initlResult.rteosq, sinio = initlResult.sinio;
        satrec.no = initlResult.no;
        satrec.con41 = initlResult.con41;
        satrec.gsto = initlResult.gsto;
        satrec.a = Math.pow(satrec.no * satrec.tumin, -2.0 / 3.0);
        satrec.alta = satrec.a * (1.0 + satrec.ecco) - 1.0;
        satrec.altp = satrec.a * (1.0 - satrec.ecco) - 1.0;
        satrec.error = 0;
        // sgp4fix remove this check as it is unnecessary
        // the mrt check in sgp4 handles decaying satellite cases even if the starting
        // condition is below the surface of te earth
        // if (rp < 1.0)
        // {
        //   printf("// *** satn%d epoch elts sub-orbital ***\n", satn);
        //   satrec.error = 5;
        // }
        if (omeosq >= 0.0 || satrec.no >= 0.0) {
            satrec.isimp = 0;
            if (rp < 220.0 / satrec.radiusearthkm + 1.0) {
                satrec.isimp = 1;
            }
            sfour = ss;
            qzms24 = qzms2t;
            perige = (rp - 1.0) * satrec.radiusearthkm;
            // - for perigees below 156 km, s and qoms2t are altered -
            if (perige < 156.0) {
                sfour = perige - 78.0;
                if (perige < 98.0) {
                    sfour = 20.0;
                }
                // sgp4fix use multiply for speed instead of pow
                qzms24temp = (120.0 - sfour) / satrec.radiusearthkm;
                qzms24 = qzms24temp * qzms24temp * qzms24temp * qzms24temp;
                sfour = sfour / satrec.radiusearthkm + 1.0;
            }
            PInvsq = 1.0 / posq;
            tsi = 1.0 / (ao - sfour);
            satrec.eta = ao * satrec.ecco * tsi;
            etasq = satrec.eta * satrec.eta;
            eeta = satrec.ecco * satrec.eta;
            psisq = Math.abs(1.0 - etasq);
            coef = qzms24 * Math.pow(tsi, 4.0);
            coef1 = coef / Math.pow(psisq, 3.5);
            cc2 =
                coef1 *
                    satrec.no *
                    (ao * (1.0 + 1.5 * etasq + eeta * (4.0 + etasq)) +
                        ((0.375 * j2 * tsi) / psisq) * satrec.con41 * (8.0 + 3.0 * etasq * (8.0 + etasq)));
            satrec.cc1 = satrec.bstar * cc2;
            cc3 = 0.0;
            if (satrec.ecco > 1.0e-4) {
                cc3 = (-2.0 * coef * tsi * j3oj2 * satrec.no * sinio) / satrec.ecco;
            }
            satrec.x1mth2 = 1.0 - cosio2;
            satrec.cc4 =
                2.0 *
                    satrec.no *
                    coef1 *
                    ao *
                    omeosq *
                    (satrec.eta * (2.0 + 0.5 * etasq) +
                        satrec.ecco * (0.5 + 2.0 * etasq) -
                        ((j2 * tsi) / (ao * psisq)) *
                            (-3.0 * satrec.con41 * (1.0 - 2.0 * eeta + etasq * (1.5 - 0.5 * eeta)) +
                                0.75 *
                                    satrec.x1mth2 *
                                    (2.0 * etasq - eeta * (1.0 + etasq)) *
                                    Math.cos(2.0 * satrec.argpo)));
            satrec.cc5 = 2.0 * coef1 * ao * omeosq * (1.0 + 2.75 * (etasq + eeta) + eeta * etasq);
            cosio4 = cosio2 * cosio2;
            temp1 = 1.5 * j2 * PInvsq * satrec.no;
            temp2 = 0.5 * temp1 * j2 * PInvsq;
            temp3 = -0.46875 * j4 * PInvsq * PInvsq * satrec.no;
            satrec.mdot =
                satrec.no +
                    0.5 * temp1 * rteosq * satrec.con41 +
                    0.0625 * temp2 * rteosq * (13.0 - 78.0 * cosio2 + 137.0 * cosio4);
            satrec.argpdot =
                -0.5 * temp1 * con42 +
                    0.0625 * temp2 * (7.0 - 114.0 * cosio2 + 395.0 * cosio4) +
                    temp3 * (3.0 - 36.0 * cosio2 + 49.0 * cosio4);
            xhdot1 = -temp1 * cosio;
            satrec.nodedot =
                xhdot1 + (0.5 * temp2 * (4.0 - 19.0 * cosio2) + 2.0 * temp3 * (3.0 - 7.0 * cosio2)) * cosio;
            xPIdot = satrec.argpdot + satrec.nodedot;
            satrec.omgcof = satrec.bstar * cc3 * Math.cos(satrec.argpo);
            satrec.xmcof = 0.0;
            if (satrec.ecco > 1.0e-4) {
                satrec.xmcof = (-x2o3 * coef * satrec.bstar) / eeta;
            }
            satrec.nodecf = 3.5 * omeosq * xhdot1 * satrec.cc1;
            satrec.t2cof = 1.5 * satrec.cc1;
            // sgp4fix for divide by zero with xinco = 180 deg
            if (Math.abs(cosio + 1.0) > 1.5e-12) {
                satrec.xlcof = (-0.25 * j3oj2 * sinio * (3.0 + 5.0 * cosio)) / (1.0 + cosio);
            }
            else {
                satrec.xlcof = (-0.25 * j3oj2 * sinio * (3.0 + 5.0 * cosio)) / temp4;
            }
            satrec.aycof = -0.5 * j3oj2 * sinio;
            // sgp4fix use multiply for speed instead of pow
            delmotemp = 1.0 + satrec.eta * Math.cos(satrec.mo);
            satrec.delmo = delmotemp * delmotemp * delmotemp;
            satrec.sinmao = Math.sin(satrec.mo);
            satrec.x7thm1 = 7.0 * cosio2 - 1.0;
            // --------------- deep space initialization -------------
            if (TAU / satrec.no >= 225.0) {
                satrec.method = 'd';
                satrec.isimp = 1;
                tc = 0.0;
                inclm = satrec.inclo;
                dscomOptions = {
                    epoch: epoch,
                    ep: satrec.ecco,
                    argpp: satrec.argpo,
                    tc: tc,
                    inclp: satrec.inclo,
                    nodep: satrec.nodeo,
                    np: satrec.no,
                    e3: satrec.e3,
                    ee2: satrec.ee2,
                    peo: satrec.peo,
                    pgho: satrec.pgho,
                    pho: satrec.pho,
                    PInco: satrec.PInco,
                    plo: satrec.plo,
                    se2: satrec.se2,
                    se3: satrec.se3,
                    sgh2: satrec.sgh2,
                    sgh3: satrec.sgh3,
                    sgh4: satrec.sgh4,
                    sh2: satrec.sh2,
                    sh3: satrec.sh3,
                    si2: satrec.si2,
                    si3: satrec.si3,
                    sl2: satrec.sl2,
                    sl3: satrec.sl3,
                    sl4: satrec.sl4,
                    xgh2: satrec.xgh2,
                    xgh3: satrec.xgh3,
                    xgh4: satrec.xgh4,
                    xh2: satrec.xh2,
                    xh3: satrec.xh3,
                    xi2: satrec.xi2,
                    xi3: satrec.xi3,
                    xl2: satrec.xl2,
                    xl3: satrec.xl3,
                    xl4: satrec.xl4,
                    zmol: satrec.zmol,
                    zmos: satrec.zmos,
                };
                dscomResult = Satjs.dscom(dscomOptions);
                satrec.e3 = dscomResult.e3;
                satrec.ee2 = dscomResult.ee2;
                satrec.peo = dscomResult.peo;
                satrec.pgho = dscomResult.pgho;
                satrec.pho = dscomResult.pho;
                satrec.PInco = dscomResult.PInco;
                satrec.plo = dscomResult.plo;
                satrec.se2 = dscomResult.se2;
                satrec.se3 = dscomResult.se3;
                satrec.sgh2 = dscomResult.sgh2;
                satrec.sgh3 = dscomResult.sgh3;
                satrec.sgh4 = dscomResult.sgh4;
                satrec.sh2 = dscomResult.sh2;
                satrec.sh3 = dscomResult.sh3;
                satrec.si2 = dscomResult.si2;
                satrec.si3 = dscomResult.si3;
                satrec.sl2 = dscomResult.sl2;
                satrec.sl3 = dscomResult.sl3;
                satrec.sl4 = dscomResult.sl4;
                var sinim_1 = dscomResult.sinim, cosim_1 = dscomResult.cosim, em_1 = dscomResult.em, emsq_1 = dscomResult.emsq, s1_1 = dscomResult.s1, s2_1 = dscomResult.s2, s3_1 = dscomResult.s3, s4_1 = dscomResult.s4, s5_1 = dscomResult.s5, ss1_1 = dscomResult.ss1, ss2_1 = dscomResult.ss2, ss3_1 = dscomResult.ss3, ss4_1 = dscomResult.ss4, ss5_1 = dscomResult.ss5, sz1_1 = dscomResult.sz1, sz3_1 = dscomResult.sz3, sz11_1 = dscomResult.sz11, sz13_1 = dscomResult.sz13, sz21_1 = dscomResult.sz21, sz23_1 = dscomResult.sz23, sz31_1 = dscomResult.sz31, sz33_1 = dscomResult.sz33;
                satrec.xgh2 = dscomResult.xgh2;
                satrec.xgh3 = dscomResult.xgh3;
                satrec.xgh4 = dscomResult.xgh4;
                satrec.xh2 = dscomResult.xh2;
                satrec.xh3 = dscomResult.xh3;
                satrec.xi2 = dscomResult.xi2;
                satrec.xi3 = dscomResult.xi3;
                satrec.xl2 = dscomResult.xl2;
                satrec.xl3 = dscomResult.xl3;
                satrec.xl4 = dscomResult.xl4;
                satrec.zmol = dscomResult.zmol;
                satrec.zmos = dscomResult.zmos;
                (nm = dscomResult.nm, z1 = dscomResult.z1, z3 = dscomResult.z3, z11 = dscomResult.z11, z13 = dscomResult.z13, z21 = dscomResult.z21, z23 = dscomResult.z23, z31 = dscomResult.z31, z33 = dscomResult.z33);
                dpperOptions = {
                    inclo: inclm,
                    init: satrec.init,
                    ep: satrec.ecco,
                    inclp: satrec.inclo,
                    nodep: satrec.nodeo,
                    argpp: satrec.argpo,
                    mp: satrec.mo,
                    opsmode: satrec.operationmode,
                };
                dpperResult = Satjs.dpper(satrec, dpperOptions);
                satrec.ecco = dpperResult.ep;
                satrec.inclo = dpperResult.inclp;
                satrec.nodeo = dpperResult.nodep;
                satrec.argpo = dpperResult.argpp;
                satrec.mo = dpperResult.mp;
                argpm = 0.0;
                nodem = 0.0;
                mm = 0.0;
                dsinitOptions = {
                    xke: xke,
                    cosim: cosim_1,
                    emsq: emsq_1,
                    argpo: satrec.argpo,
                    s1: s1_1,
                    s2: s2_1,
                    s3: s3_1,
                    s4: s4_1,
                    s5: s5_1,
                    sinim: sinim_1,
                    ss1: ss1_1,
                    ss2: ss2_1,
                    ss3: ss3_1,
                    ss4: ss4_1,
                    ss5: ss5_1,
                    sz1: sz1_1,
                    sz3: sz3_1,
                    sz11: sz11_1,
                    sz13: sz13_1,
                    sz21: sz21_1,
                    sz23: sz23_1,
                    sz31: sz31_1,
                    sz33: sz33_1,
                    t: satrec.t,
                    tc: tc,
                    gsto: satrec.gsto,
                    mo: satrec.mo,
                    mdot: satrec.mdot,
                    no: satrec.no,
                    nodeo: satrec.nodeo,
                    nodedot: satrec.nodedot,
                    xPIdot: xPIdot,
                    z1: z1,
                    z3: z3,
                    z11: z11,
                    z13: z13,
                    z21: z21,
                    z23: z23,
                    z31: z31,
                    z33: z33,
                    ecco: satrec.ecco,
                    eccsq: eccsq,
                    em: em_1,
                    argpm: argpm,
                    inclm: inclm,
                    mm: mm,
                    nm: nm,
                    nodem: nodem,
                    irez: satrec.irez,
                    atime: satrec.atime,
                    d2201: satrec.d2201,
                    d2211: satrec.d2211,
                    d3210: satrec.d3210,
                    d3222: satrec.d3222,
                    d4410: satrec.d4410,
                    d4422: satrec.d4422,
                    d5220: satrec.d5220,
                    d5232: satrec.d5232,
                    d5421: satrec.d5421,
                    d5433: satrec.d5433,
                    dedt: satrec.dedt,
                    didt: satrec.didt,
                    dmdt: satrec.dmdt,
                    dnodt: satrec.dnodt,
                    domdt: satrec.domdt,
                    del1: satrec.del1,
                    del2: satrec.del2,
                    del3: satrec.del3,
                    xfact: satrec.xfact,
                    xlamo: satrec.xlamo,
                    xli: satrec.xli,
                    xni: satrec.xni,
                };
                dsinitResult = Satjs.dsinit(dsinitOptions);
                satrec.irez = dsinitResult.irez;
                satrec.atime = dsinitResult.atime;
                satrec.d2201 = dsinitResult.d2201;
                satrec.d2211 = dsinitResult.d2211;
                satrec.d3210 = dsinitResult.d3210;
                satrec.d3222 = dsinitResult.d3222;
                satrec.d4410 = dsinitResult.d4410;
                satrec.d4422 = dsinitResult.d4422;
                satrec.d5220 = dsinitResult.d5220;
                satrec.d5232 = dsinitResult.d5232;
                satrec.d5421 = dsinitResult.d5421;
                satrec.d5433 = dsinitResult.d5433;
                satrec.dedt = dsinitResult.dedt;
                satrec.didt = dsinitResult.didt;
                satrec.dmdt = dsinitResult.dmdt;
                satrec.dnodt = dsinitResult.dnodt;
                satrec.domdt = dsinitResult.domdt;
                satrec.del1 = dsinitResult.del1;
                satrec.del2 = dsinitResult.del2;
                satrec.del3 = dsinitResult.del3;
                satrec.xfact = dsinitResult.xfact;
                satrec.xlamo = dsinitResult.xlamo;
                satrec.xli = dsinitResult.xli;
                satrec.xni = dsinitResult.xni;
            }
            // ----------- set variables if not deep space -----------
            if (satrec.isimp !== 1) {
                cc1sq = satrec.cc1 * satrec.cc1;
                satrec.d2 = 4.0 * ao * tsi * cc1sq;
                temp = (satrec.d2 * tsi * satrec.cc1) / 3.0;
                satrec.d3 = (17.0 * ao + sfour) * temp;
                satrec.d4 = 0.5 * temp * ao * tsi * (221.0 * ao + 31.0 * sfour) * satrec.cc1;
                satrec.t3cof = satrec.d2 + 2.0 * cc1sq;
                satrec.t4cof = 0.25 * (3.0 * satrec.d3 + satrec.cc1 * (12.0 * satrec.d2 + 10.0 * cc1sq));
                satrec.t5cof =
                    0.2 *
                        (3.0 * satrec.d4 +
                            12.0 * satrec.cc1 * satrec.d3 +
                            6.0 * satrec.d2 * satrec.d2 +
                            15.0 * cc1sq * (2.0 * satrec.d2 + cc1sq));
            } // if omeosq = 0 ...
            /* finally propogate to zero epoch to initialize all others. */
            // sgp4fix take out check to let satellites process until they are actually below earth surface
            // if(satrec.error == 0)
        }
        Satjs.sgp4(satrec, 0);
        satrec.init = 'n';
        //sgp4fix return boolean. satrec.error contains any error codes
        // return satrec; -- no reason to return anything in JS
    }; // sgp4init
    /*----------------------------------------------------------------------------
   *
   *                             procedure sgp4
   *
   *  this procedure is the sgp4 prediction model from space command. this is an
   *    updated and combined version of sgp4 and sdp4, which were originally
   *    published separately in spacetrack report //3. this version follows the
   *    methodology from the aiaa paper (2006) describing the history and
   *    development of the code.
   *
   *  author        : david vallado                  719-573-2600   28 jun 2005
   *
   *  inputs        :
   *    satrec  - initialised structure from sgp4init() call.
   *    tsince  - time since epoch (minutes)
   *
   *  outputs       :
   *    r           - position vector                     km
   *    v           - velocity                            km/sec
   *  return code - non-zero on error.
   *                   1 - mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er
   *                   2 - mean motion less than 0.0
   *                   3 - pert elements, ecc < 0.0  or  ecc > 1.0
   *                   4 - semi-latus rectum < 0.0
   *                   5 - epoch elements are sub-orbital
   *                   6 - satellite has decayed
   *
   *  locals        :
   *    am          -
   *    axnl, aynl        -
   *    betal       -
   *    cosim   , sinim   , cosomm  , sinomm  , cnod    , snod    , cos2u   ,
   *    sin2u   , coseo1  , sineo1  , cosi    , sini    , cosip   , sinip   ,
   *    cosisq  , cossu   , sinsu   , cosu    , sinu
   *    delm        -
   *    delomg      -
   *    dndt        -
   *    eccm        -
   *    emsq        -
   *    ecose       -
   *    el2         -
   *    eo1         -
   *    eccp        -
   *    esine       -
   *    argpm       -
   *    argpp       -
   *    omgadf      -
   *    pl          -
   *    r           -
   *    rtemsq      -
   *    rdotl       -
   *    rl          -
   *    rvdot       -
   *    rvdotl      -
   *    su          -
   *    t2  , t3   , t4    , tc
   *    tem5, temp , temp1 , temp2  , tempa  , tempe  , templ
   *    u   , ux   , uy    , uz     , vx     , vy     , vz
   *    inclm       - inclination
   *    mm          - mean anomaly
   *    nm          - mean motion
   *    nodem       - right asc of ascending node
   *    xinc        -
   *    xincp       -
   *    xl          -
   *    xlm         -
   *    mp          -
   *    xmdf        -
   *    xmx         -
   *    xmy         -
   *    nodedf      -
   *    xnode       -
   *    nodep       -
   *    np          -
   *
   *  coupling      :
   *    getgravconst-
   *    dpper
   *    dspace
   *
   *  references    :
   *    hoots, roehrich, norad spacetrack report //3 1980
   *    hoots, norad spacetrack report //6 1986
   *    hoots, schumacher and glover 2004
   *    vallado, crawford, hujsak, kelso  2006
   ----------------------------------------------------------------------------*/
    Satjs.sgp4 = function (satrec, tsince) {
        /* ------------------ set mathematical constants --------------- */
        // sgp4fix divisor for divide by zero check on inclination
        // the old check used 1.0 + cos(PI-1.0e-9), but then compared it to
        // 1.5 e-12, so the threshold was changed to 1.5e-12 for consistency
        /** Satjs -- Declared at the top of the page */
        // temp4 = 1.5e-12;
        // sgp4fix identify constants and allow alternate values
        // getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
        vkmpersec = (satrec.radiusearthkm * satrec.xke) / 60.0;
        // --------------------- clear sgp4 error flag -----------------
        satrec.t = tsince;
        satrec.error = 0;
        //  ------- update for secular gravity and atmospheric drag -----
        xmdf = satrec.mo + satrec.mdot * satrec.t;
        argpdf = satrec.argpo + satrec.argpdot * satrec.t;
        nodedf = satrec.nodeo + satrec.nodedot * satrec.t;
        argpm = argpdf;
        mm = xmdf;
        t2 = satrec.t * satrec.t;
        nodem = nodedf + satrec.nodecf * t2;
        tempa = 1.0 - satrec.cc1 * satrec.t;
        tempe = satrec.bstar * satrec.cc4 * satrec.t;
        templ = satrec.t2cof * t2;
        if (satrec.isimp !== 1) {
            delomg = satrec.omgcof * satrec.t;
            //  sgp4fix use mutliply for speed instead of pow
            delmtemp = 1.0 + satrec.eta * Math.cos(xmdf);
            delm = satrec.xmcof * (delmtemp * delmtemp * delmtemp - satrec.delmo);
            temp = delomg + delm;
            mm = xmdf + temp;
            argpm = argpdf - temp;
            t3 = t2 * satrec.t;
            t4 = t3 * satrec.t;
            tempa = tempa - satrec.d2 * t2 - satrec.d3 * t3 - satrec.d4 * t4;
            tempe += satrec.bstar * satrec.cc5 * (Math.sin(mm) - satrec.sinmao);
            templ = templ + satrec.t3cof * t3 + t4 * (satrec.t4cof + satrec.t * satrec.t5cof);
        }
        nm = satrec.no;
        em = satrec.ecco;
        inclm = satrec.inclo;
        if (satrec.method === 'd') {
            tc = satrec.t;
            dspaceOptions = {
                irez: satrec.irez,
                d2201: satrec.d2201,
                d2211: satrec.d2211,
                d3210: satrec.d3210,
                d3222: satrec.d3222,
                d4410: satrec.d4410,
                d4422: satrec.d4422,
                d5220: satrec.d5220,
                d5232: satrec.d5232,
                d5421: satrec.d5421,
                d5433: satrec.d5433,
                dedt: satrec.dedt,
                del1: satrec.del1,
                del2: satrec.del2,
                del3: satrec.del3,
                didt: satrec.didt,
                dmdt: satrec.dmdt,
                dnodt: satrec.dnodt,
                domdt: satrec.domdt,
                argpo: satrec.argpo,
                argpdot: satrec.argpdot,
                t: satrec.t,
                tc: tc,
                gsto: satrec.gsto,
                xfact: satrec.xfact,
                xlamo: satrec.xlamo,
                no: satrec.no,
                atime: satrec.atime,
                em: em,
                argpm: argpm,
                inclm: inclm,
                xli: satrec.xli,
                mm: mm,
                xni: satrec.xni,
                nodem: nodem,
                nm: nm,
            };
            dspaceResult = Satjs.dspace(dspaceOptions);
            (em = dspaceResult.em, argpm = dspaceResult.argpm, inclm = dspaceResult.inclm, mm = dspaceResult.mm, nodem = dspaceResult.nodem, nm = dspaceResult.nm);
        } // if methjod = d
        if (nm <= 0.0) {
            // printf("// error nm %f\n", nm);
            satrec.error = 2;
            // sgp4fix add return
            return { position: false, velocity: false };
        }
        am = Math.pow((xke / nm), x2o3) * tempa * tempa;
        nm = xke / Math.pow(am, 1.5);
        em -= tempe;
        // fix tolerance for error recognition
        // sgp4fix am is fixed from the previous nm check
        /* istanbul ignore next | This is no longer possible*/
        if (em >= 1.0 || em < -0.001) {
            // || (am < 0.95)
            // printf("// error em %f\n", em);
            satrec.error = 1;
            // sgp4fix to return if there is an error in eccentricity
            return { position: false, velocity: false };
        }
        //  sgp4fix fix tolerance to avoid a divide by zero
        if (em < 1.0e-6) {
            em = 1.0e-6;
        }
        mm += satrec.no * templ;
        xlm = mm + argpm + nodem;
        nodem %= TAU;
        argpm %= TAU;
        xlm %= TAU;
        mm = (xlm - argpm - nodem) % TAU;
        // sgp4fix recover singly averaged mean elements
        satrec.am = am;
        satrec.em = em;
        satrec.im = inclm;
        satrec.Om = nodem;
        satrec.om = argpm;
        satrec.mm = mm;
        satrec.nm = nm;
        // ----------------- compute extra mean quantities -------------
        sinim = Math.sin(inclm);
        cosim = Math.cos(inclm);
        // -------------------- add lunar-solar periodics --------------
        ep = em;
        xincp = inclm;
        argpp = argpm;
        nodep = nodem;
        mp = mm;
        sinip = sinim;
        cosip = cosim;
        if (satrec.method === 'd') {
            dpperParameters = {
                inclo: satrec.inclo,
                init: 'n',
                ep: ep,
                inclp: xincp,
                nodep: nodep,
                argpp: argpp,
                mp: mp,
                opsmode: satrec.operationmode,
            };
            dpperResult = Satjs.dpper(satrec, dpperParameters);
            (ep = dpperResult.ep, nodep = dpperResult.nodep, argpp = dpperResult.argpp, mp = dpperResult.mp);
            xincp = dpperResult.inclp;
            if (xincp < 0.0) {
                xincp = -xincp;
                nodep += PI;
                argpp -= PI;
            }
            if (ep < 0.0 || ep > 1.0) {
                //  printf("// error ep %f\n", ep);
                satrec.error = 3;
                //  sgp4fix add return
                return { position: false, velocity: false };
            }
        }
        //  -------------------- long period periodics ------------------
        if (satrec.method === 'd') {
            sinip = Math.sin(xincp);
            cosip = Math.cos(xincp);
            satrec.aycof = -0.5 * j3oj2 * sinip;
            //  sgp4fix for divide by zero for xincp = 180 deg
            /* istanbul ignore next | This is no longer possible*/
            if (Math.abs(cosip + 1.0) > 1.5e-12) {
                satrec.xlcof = (-0.25 * j3oj2 * sinip * (3.0 + 5.0 * cosip)) / (1.0 + cosip);
            }
            else {
                satrec.xlcof = (-0.25 * j3oj2 * sinip * (3.0 + 5.0 * cosip)) / temp4;
            }
        }
        axnl = ep * Math.cos(argpp);
        temp = 1.0 / (am * (1.0 - ep * ep));
        aynl = ep * Math.sin(argpp) + temp * satrec.aycof;
        xl = mp + argpp + nodep + temp * satrec.xlcof * axnl;
        // --------------------- solve kepler's equation ---------------
        u = (xl - nodep) % TAU;
        eo1 = u;
        tem5 = 9999.9;
        ktr = 1;
        //    sgp4fix for kepler iteration
        //    the following iteration needs better limits on corrections
        while (Math.abs(tem5) >= 1.0e-12 && ktr <= 10) {
            sineo1 = Math.sin(eo1);
            coseo1 = Math.cos(eo1);
            tem5 = 1.0 - coseo1 * axnl - sineo1 * aynl;
            tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5;
            if (Math.abs(tem5) >= 0.95) {
                if (tem5 > 0.0) {
                    tem5 = 0.95;
                }
                else {
                    tem5 = -0.95;
                }
            }
            eo1 += tem5;
            ktr += 1;
        }
        //  ------------- short period preliminary quantities -----------
        ecose = axnl * coseo1 + aynl * sineo1;
        esine = axnl * sineo1 - aynl * coseo1;
        el2 = axnl * axnl + aynl * aynl;
        pl = am * (1.0 - el2);
        if (pl < 0.0) {
            //  printf("// error pl %f\n", pl);
            satrec.error = 4;
            //  sgp4fix add return
            return { position: false, velocity: false };
        }
        rl = am * (1.0 - ecose);
        rdotl = (Math.sqrt(am) * esine) / rl;
        rvdotl = Math.sqrt(pl) / rl;
        betal = Math.sqrt(1.0 - el2);
        temp = esine / (1.0 + betal);
        sinu = (am / rl) * (sineo1 - aynl - axnl * temp);
        cosu = (am / rl) * (coseo1 - axnl + aynl * temp);
        su = Math.atan2(sinu, cosu);
        sin2u = (cosu + cosu) * sinu;
        cos2u = 1.0 - 2.0 * sinu * sinu;
        temp = 1.0 / pl;
        temp1 = 0.5 * j2 * temp;
        temp2 = temp1 * temp;
        // -------------- update for short period periodics ------------
        if (satrec.method === 'd') {
            cosisq = cosip * cosip;
            satrec.con41 = 3.0 * cosisq - 1.0;
            satrec.x1mth2 = 1.0 - cosisq;
            satrec.x7thm1 = 7.0 * cosisq - 1.0;
        }
        mrt = rl * (1.0 - 1.5 * temp2 * betal * satrec.con41) + 0.5 * temp1 * satrec.x1mth2 * cos2u;
        /** Moved this up to reduce unnecessary computation if you are going to return false anyway */
        // sgp4fix for decaying satellites
        if (mrt < 1.0) {
            // printf("// decay condition %11.6f \n",mrt);
            satrec.error = 6;
            return {
                position: false,
                velocity: false,
            };
        }
        su -= 0.25 * temp2 * satrec.x7thm1 * sin2u;
        xnode = nodep + 1.5 * temp2 * cosip * sin2u;
        xinc = xincp + 1.5 * temp2 * cosip * sinip * cos2u;
        mvt = rdotl - (nm * temp1 * satrec.x1mth2 * sin2u) / xke;
        rvdot = rvdotl + (nm * temp1 * (satrec.x1mth2 * cos2u + 1.5 * satrec.con41)) / xke;
        // --------------------- orientation vectors -------------------
        sinsu = Math.sin(su);
        cossu = Math.cos(su);
        snod = Math.sin(xnode);
        cnod = Math.cos(xnode);
        sini = Math.sin(xinc);
        cosi = Math.cos(xinc);
        xmx = -snod * cosi;
        xmy = cnod * cosi;
        ux = xmx * sinsu + cnod * cossu;
        uy = xmy * sinsu + snod * cossu;
        uz = sini * sinsu;
        vx = xmx * cossu - cnod * sinsu;
        vy = xmy * cossu - snod * sinsu;
        vz = sini * cossu;
        // --------- position and velocity (in km and km/sec) ----------
        r = {
            x: mrt * ux * satrec.radiusearthkm,
            y: mrt * uy * satrec.radiusearthkm,
            z: mrt * uz * satrec.radiusearthkm,
        };
        v = {
            x: (mvt * ux + rvdot * vx) * vkmpersec,
            y: (mvt * uy + rvdot * vy) * vkmpersec,
            z: (mvt * uz + rvdot * vz) * vkmpersec,
        };
        return {
            position: r,
            velocity: v,
        };
    };
    /* -----------------------------------------------------------------------------
    *
    *                           function getgravconst
    *
    *  this function gets constants for the propagator. note that mu is identified to
    *    facilitiate comparisons with newer models. the common useage is wgs72.
    *
    *  author        : david vallado                  719-573-2600   21 jul 2006
    *
    *  inputs        :
    *    whichconst  - which set of constants to use  wgs72old, wgs72, wgs84
    *
    *  outputs       :
    *    tumin       - minutes in one time unit
    *    mu          - earth gravitational parameter
    *    radiusearthkm - radius of the earth in km
    *    xke         - reciprocal of tumin
    *    j2, j3, j4  - un-normalized zonal harmonic values
    *    j3oj2       - j3 divided by j2
    *
    *  locals        :
    *
    *  coupling      :
    *    none
    *
    *  references    :
    *    norad spacetrack report #3
    *    vallado, crawford, hujsak, kelso  2006
    --------------------------------------------------------------------------- */
    Satjs.getgravconst = function (whichconst) {
        switch (whichconst) {
            // -- wgs-72 low precision str#3 constants --
            case 'wgs72old':
                mus = 398600.79964; // in km3 / s2
                radiusearthkm = 6378.135; // km
                xke = 0.0743669161; // reciprocal of tumin
                tumin = 1.0 / xke;
                j2 = 0.001082616;
                j3 = -0.00000253881;
                j4 = -0.00000165597;
                j3oj2 = j3 / j2;
                break;
            // ------------ wgs-72 constants ------------
            case 'wgs72':
                mus = 398600.8; // in km3 / s2
                radiusearthkm = 6378.135; // km
                xke = 60.0 / Math.sqrt((radiusearthkm * radiusearthkm * radiusearthkm) / mus);
                tumin = 1.0 / xke;
                j2 = 0.001082616;
                j3 = -0.00000253881;
                j4 = -0.00000165597;
                j3oj2 = j3 / j2;
                break;
            case 'wgs84':
                // ------------ wgs-84 constants ------------
                mus = 398600.5; // in km3 / s2
                radiusearthkm = 6378.137; // km
                xke = 60.0 / Math.sqrt((radiusearthkm * radiusearthkm * radiusearthkm) / mus);
                tumin = 1.0 / xke;
                j2 = 0.00108262998905;
                j3 = -0.00000253215306;
                j4 = -0.00000161098761;
                j3oj2 = j3 / j2;
                break;
            default:
                throw new Error("unknown gravity option " + whichconst);
        }
        return {
            tumin: tumin,
            mus: mus,
            radiusearthkm: radiusearthkm,
            xke: xke,
            j2: j2,
            j3: j3,
            j4: j4,
            j3oj2: j3oj2,
        };
    }; // getgravconst
    /* -----------------------------------------------------------------------------
   *
   *                           function twoline2rv
   *
   *  this function converts the two line element set character string data to
   *    variables and initializes the sgp4 variables. several intermediate varaibles
   *    and quantities are determined. note that the result is a structure so multiple
   *    satellites can be processed simultaneously without having to reinitialize. the
   *    verification mode is an important option that permits quick checks of any
   *    changes to the underlying technical theory. this option works using a
   *    modified tle file in which the start, stop, and delta time values are
   *    included at the end of the second line of data. this only works with the
   *    verification mode. the catalog mode simply propagates from -1440 to 1440 min
   *    from epoch and is useful when performing entire catalog runs.
   *
   *  author        : david vallado                  719-573-2600    1 mar 2001
   *
   *  inputs        :
   *    longstr1    - first line of the tle
   *    longstr2    - second line of the tle
   *    typerun     - type of run                    verification 'v', catalog 'c',
   *                                                 manual 'm'
   *    typeinput   - type of manual input           mfe 'm', epoch 'e', dayofyr 'd'
   *    opsmode     - mode of operation afspc or improved 'a', 'i'
   *    whichconst  - which set of constants to use  72, 84
   *
   *  outputs       :
   *    satrec      - structure containing all the sgp4 satellite information
   *
   *  coupling      :
   *    getgravconst-
   *    days2mdhms  - conversion of days to month, day, hour, minute, second
   *    jday        - convert day month year hour minute second into julian date
   *    sgp4init    - initialize the sgp4 variables
   *
   *  references    :
   *    norad spacetrack report #3
   *    vallado, crawford, hujsak, kelso  2006
   --------------------------------------------------------------------------- */
    Satjs.twoline2rv = function (tleLine1, tleLine2, whichconst, opsmode) {
        if (whichconst === void 0) { whichconst = 'wgs72'; }
        if (opsmode === void 0) { opsmode = 'i'; }
        // xpdotp = 1440.0 / (2.0 * PI); // 229.1831180523293;
        year = 0;
        satrec = {};
        // sgp4fix no longer needed
        // getgravconst( whichconst, tumin, mu, radiusearthkm, xke, j2, j3, j4, j3oj2 );
        satrec.error = 0;
        satrec.satnum = tleLine1.substring(2, 7);
        satrec.epochyr = parseInt(tleLine1.substring(18, 20));
        satrec.epochdays = parseFloat(tleLine1.substring(20, 32));
        satrec.ndot = parseFloat(tleLine1.substring(33, 43));
        satrec.nddot = parseFloat(tleLine1.substring(44, 45) + "." + tleLine1.substring(45, 50) + "E" + tleLine1.substring(50, 52));
        satrec.bstar = parseFloat(tleLine1.substring(53, 54) + "." + tleLine1.substring(54, 59) + "E" + tleLine1.substring(59, 61));
        // satrec.satnum = tleLine2.substring(2, 7);
        satrec.inclo = parseFloat(tleLine2.substring(8, 16));
        satrec.nodeo = parseFloat(tleLine2.substring(17, 25));
        satrec.ecco = parseFloat("." + tleLine2.substring(26, 33));
        satrec.argpo = parseFloat(tleLine2.substring(34, 42));
        satrec.mo = parseFloat(tleLine2.substring(43, 51));
        satrec.no = parseFloat(tleLine2.substring(52, 63));
        // ---- find no, ndot, nddot ----
        satrec.no /= xpdotp; //   rad/min
        /** Satjs -- nexp and ibexp are calculated above using template literals */
        // satrec.nddot = satrec.nddot * Math.pow(10.0, nexp);
        // satrec.bstar = satrec.bstar * Math.pow(10.0, ibexp);
        // ---- convert to sgp4 units ----
        // satrec.a = (satrec.no * tumin) ** (-2.0 / 3.0);
        /** Satjs -- Not sure why the following two lines are added. 1st and 2nd derivatives aren't even used anymore */
        // satrec.ndot /= xpdotp * 1440.0; // ? * minperday
        // satrec.nddot /= xpdotp * 1440.0 * 1440;
        // ---- find standard orbital elements ----
        satrec.inclo *= DEG2RAD;
        satrec.nodeo *= DEG2RAD;
        satrec.argpo *= DEG2RAD;
        satrec.mo *= DEG2RAD;
        // sgp4fix not needed here
        // satrec.alta = satrec.a * (1.0 + satrec.ecco) - 1.0;
        // satrec.altp = satrec.a * (1.0 - satrec.ecco) - 1.0;
        // ----------------------------------------------------------------
        // find sgp4epoch time of element set
        // remember that sgp4 uses units of days from 0 jan 1950 (sgp4epoch)
        // and minutes from the epoch (time)
        // ----------------------------------------------------------------
        // ---------------- temp fix for years from 1957-2056 -------------------
        // --------- correct fix will occur when year is 4-digit in tle ---------
        if (satrec.epochyr < 57) {
            year = satrec.epochyr + 2000;
        }
        else {
            year = satrec.epochyr + 1900;
        }
        var _a = Satjs.days2mdhms(year, satrec.epochdays), mon = _a.mon, day = _a.day, hr = _a.hr, minute = _a.minute, sec = _a.sec;
        var jdayRes = Satjs.jday(year, mon, day, hr, minute, sec);
        satrec.jdsatepoch = jdayRes.jd + jdayRes.jdFrac;
        //  ---------------- initialize the orbit at sgp4epoch -------------------
        Satjs.sgp4init(satrec, {
            whichconst: whichconst,
            opsmode: opsmode,
            satn: satrec.satnum,
            epoch: satrec.jdsatepoch - 2433281.5,
            xbstar: satrec.bstar,
            xecco: satrec.ecco,
            xargpo: satrec.argpo,
            xinclo: satrec.inclo,
            xndot: satrec.ndot,
            xnddot: satrec.nddot,
            xmo: satrec.mo,
            xno: satrec.no,
            xnodeo: satrec.nodeo,
        });
        return satrec;
    }; // twoline2rv
    /* -----------------------------------------------------------------------------
     *
     *                           function gstime
     *
     *  this function finds the greenwich sidereal time.
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    jdut1       - julian date in ut1             days from 4713 bc
     *
     *  outputs       :
     *    gstime      - greenwich sidereal time        0 to 2PI rad
     *
     *  locals        :
     *    temp        - temporary variable for doubles   rad
     *    tut1        - julian centuries from the
     *                  jan 1, 2000 12 h epoch (ut1)
     *
     *  coupling      :
     *    none
     *
     *  references    :
     *    vallado       2004, 191, eq 3-45
     * --------------------------------------------------------------------------- */
    Satjs.gstime = function (jdut1) {
        tut1 = (jdut1 - 2451545.0) / 36525.0;
        var temp = -6.2e-6 * tut1 * tut1 * tut1 +
            0.093104 * tut1 * tut1 +
            (876600.0 * 3600 + 8640184.812866) * tut1 +
            67310.54841; // sec
        temp = ((temp * DEG2RAD) / 240.0) % TAU; // 360/86400 = 1/240, to deg, to rad
        //  ------------------------ check quadrants ---------------------
        if (temp < 0.0) {
            temp += TAU;
        }
        return temp;
    };
    Satjs.sgn = function (x) {
        if (x < 0.0) {
            return -1.0;
        }
        else {
            return 1.0;
        }
    }; // sgn
    /* -----------------------------------------------------------------------------
     *
     *                           function mag
     *
     *  this procedure finds the magnitude of a vector.
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    vec         - vector
     *
     *  outputs       :
     *    mag         - answer
     *
     *  locals        :
     *    none.
     *
     *  coupling      :
     *    none.
     * --------------------------------------------------------------------------- */
    Satjs.mag = function (x) {
        return Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
    }; // mag
    /* -----------------------------------------------------------------------------
    *
    *                           procedure cross_SGP4
    *
    *  this procedure crosses two vectors.
    *
    *  author        : david vallado                  719-573-2600    1 mar 2001
    *
    *  inputs          description                    range / units
    *    vec1        - vector number 1
    *    vec2        - vector number 2
    *
    *  outputs       :
    *    outvec      - vector result of a x b
    *
    *  locals        :
    *    none.
    *
    *  coupling      :
    *    mag           magnitude of a vector
    ---------------------------------------------------------------------------- */
    Satjs.cross = function (vec1, vec2) {
        var outvec = [0, 0, 0];
        outvec[0] = vec1[1] * vec2[2] - vec1[2] * vec2[1];
        outvec[1] = vec1[2] * vec2[0] - vec1[0] * vec2[2];
        outvec[2] = vec1[0] * vec2[1] - vec1[1] * vec2[0];
        return outvec;
    }; // end cross
    /* -----------------------------------------------------------------------------
     *
     *                           function dot_SGP4
     *
     *  this function finds the dot product of two vectors.
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    vec1        - vector number 1
     *    vec2        - vector number 2
     *
     *  outputs       :
     *    dot         - result
     *
     *  locals        :
     *    none.
     *
     *  coupling      :
     *    none.
     * --------------------------------------------------------------------------- */
    Satjs.dot = function (x, y) {
        return x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
    }; // dot
    /* -----------------------------------------------------------------------------
     *
     *                           procedure angle_SGP4
     *
     *  this procedure calculates the angle between two vectors.  the output is
     *    set to 999999.1 to indicate an undefined value.  be sure to check for
     *    this at the output phase.
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    vec1        - vector number 1
     *    vec2        - vector number 2
     *
     *  outputs       :
     *    theta       - angle between the two vectors  -pi to pi
     *
     *  locals        :
     *    temp        - temporary real variable
     *
     *  coupling      :
     *    dot           dot product of two vectors
     * --------------------------------------------------------------------------- */
    Satjs.angle = function (vec1, vec2) {
        var small = 0.00000001;
        var unknown = 999999.1; /** Satjs -- original 'undefined' is protected in JS */
        var magv1 = Satjs.mag(vec1);
        var magv2 = Satjs.mag(vec2);
        if (magv1 * magv2 > small * small) {
            temp = Satjs.dot(vec1, vec2) / (magv1 * magv2);
            if (Math.abs(temp) > 1.0)
                temp = Satjs.sgn(temp) * 1.0;
            return Math.acos(temp);
        }
        else
            return unknown;
    }; // angle
    /* -----------------------------------------------------------------------------
     *
     *                           function asinh_SGP4
     *
     *  this function evaluates the inverse hyperbolic sine function.
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    xval        - angle value                                  any real
     *
     *  outputs       :
     *    arcsinh     - result                                       any real
     *
     *  locals        :
     *    none.
     *
     *  coupling      :
     *    none.
     * --------------------------------------------------------------------------- */
    Satjs.asinh = function (xval) {
        return Math.log(xval + Math.sqrt(xval * xval + 1.0));
    }; // asinh
    /* -----------------------------------------------------------------------------
     *
     *                           function newtonnu_SGP4
     *
     *  this function solves keplers equation when the true anomaly is known.
     *    the mean and eccentric, parabolic, or hyperbolic anomaly is also found.
     *    the parabolic limit at 168ø is arbitrary. the hyperbolic anomaly is also
     *    limited. the hyperbolic sine is used because it's not double valued.
     *
     *  author        : david vallado                  719-573-2600   27 may 2002
     *
     *  revisions
     *    vallado     - fix small                                     24 sep 2002
     *
     *  inputs          description                    range / units
     *    ecc         - eccentricity                   0.0  to
     *    nu          - true anomaly                   -2pi to 2pi rad
     *
     *  outputs       :
     *    e0          - eccentric anomaly              0.0  to 2pi rad       153.02 ø
     *    m           - mean anomaly                   0.0  to 2pi rad       151.7425 ø
     *
     *  locals        :
     *    e1          - eccentric anomaly, next value  rad
     *    sine        - sine of e
     *    cose        - cosine of e
     *    ktr         - index
     *
     *  coupling      :
     *    asinh       - arc hyperbolic sine
     *
     *  references    :
     *    vallado       2013, 77, alg 5
     * --------------------------------------------------------------------------- */
    Satjs.newtonnu = function (ecc, nu) {
        // ---------------------  implementation   ---------------------
        var e0 = 999999.9;
        var m = 999999.9;
        var small = 0.00000001;
        // --------------------------- circular ------------------------
        if (Math.abs(ecc) < small) {
            m = nu;
            e0 = nu;
        }
        // ---------------------- elliptical -----------------------
        else if (ecc < 1.0 - small) {
            var sine = (Math.sqrt(1.0 - ecc * ecc) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
            var cose = (ecc + Math.cos(nu)) / (1.0 + ecc * Math.cos(nu));
            e0 = Math.atan2(sine, cose);
            m = e0 - ecc * Math.sin(e0);
        }
        // -------------------- hyperbolic  --------------------
        else if (ecc > 1.0 + small) {
            if (ecc > 1.0 && Math.abs(nu) + 0.00001 < PI - Math.acos(1.0 / ecc)) {
                var sine = (Math.sqrt(ecc * ecc - 1.0) * Math.sin(nu)) / (1.0 + ecc * Math.cos(nu));
                e0 = Satjs.asinh(sine);
                m = ecc * Satjs.sinh(e0) - e0;
            }
        }
        // ----------------- parabolic ---------------------
        else if (Math.abs(nu) < (168.0 * PI) / 180.0) {
            e0 = Math.tan(nu * 0.5);
            m = e0 + (e0 * e0 * e0) / 3.0;
        }
        if (ecc < 1.0) {
            m = m % (2.0 * PI);
            if (m < 0.0)
                m = m + 2.0 * PI;
            e0 = e0 % (2.0 * PI);
        }
        return {
            e0: e0,
            m: m,
        };
    }; // newtonnu
    Satjs.sinh = function (x) {
        return (Math.exp(x) - Math.exp(-x)) / 2;
    };
    /* -----------------------------------------------------------------------------
     *
     *                           function rv2coe_SGP4
     *
     *  this function finds the classical orbital elements given the geocentric
     *    equatorial position and velocity vectors.
     *
     *  author        : david vallado                  719-573-2600   21 jun 2002
     *
     *  revisions
     *    vallado     - fix special cases                              5 sep 2002
     *    vallado     - delete extra check in inclination code        16 oct 2002
     *    vallado     - add constant file use                         29 jun 2003
     *    vallado     - add mu                                         2 apr 2007
     *
     *  inputs          description                    range / units
     *    r           - ijk position vector            km
     *    v           - ijk velocity vector            km / s
     *    mu          - gravitational parameter        km3 / s2
     *
     *  outputs       :
     *    p           - semilatus rectum               km
     *    a           - semimajor axis                 km
     *    ecc         - eccentricity
     *    incl        - inclination                    0.0  to pi rad
     *    omega       - right ascension of ascending node    0.0  to 2pi rad
     *    argp        - argument of perigee            0.0  to 2pi rad
     *    nu          - true anomaly                   0.0  to 2pi rad
     *    m           - mean anomaly                   0.0  to 2pi rad
     *    arglat      - argument of latitude      (ci) 0.0  to 2pi rad
     *    truelon     - true longitude            (ce) 0.0  to 2pi rad
     *    lonper      - longitude of periapsis    (ee) 0.0  to 2pi rad
     *
     *  locals        :
     *    hbar        - angular momentum h vector      km2 / s
     *    ebar        - eccentricity     e vector
     *    nbar        - line of nodes    n vector
     *    c1          - v**2 - u/r
     *    rdotv       - r dot v
     *    hk          - hk unit vector
     *    sme         - specfic mechanical energy      km2 / s2
     *    i           - index
     *    e           - eccentric, parabolic,
     *                  hyperbolic anomaly             rad
     *    temp        - temporary variable
     *    typeorbit   - type of orbit                  ee, ei, ce, ci
     *
     *  coupling      :
     *    mag         - magnitude of a vector
     *    cross       - cross product of two vectors
     *    angle       - find the angle between two vectors
     *    newtonnu    - find the mean anomaly
     *
     *  references    :
     *    vallado       2013, 113, alg 9, ex 2-5
     * --------------------------------------------------------------------------- */
    Satjs.rv2coe = function (r, v, mus) {
        var nbar = [0, 0, 0];
        var ebar = [0, 0, 0];
        var p;
        var a;
        var ecc;
        var incl;
        var omega;
        var argp;
        var nu;
        var m;
        var arglat;
        var truelon;
        var lonper;
        var rdotv;
        var magn;
        var hk;
        var sme;
        var i;
        // switch this to an integer msvs seems to have probelms with this and strncpy_s
        //char typeorbit[2];
        var typeorbit;
        // here
        // typeorbit = 1 = 'ei'
        // typeorbit = 2 = 'ce'
        // typeorbit = 3 = 'ci'
        // typeorbit = 4 = 'ee'
        var halfpi = 0.5 * PI;
        var small = 0.00000001;
        var unknown = 999999.1; /** Satjs -- original undefined is illegal in JS */
        var infinite = 999999.9;
        // -------------------------  implementation   -----------------
        var magr = Satjs.mag(r);
        var magv = Satjs.mag(v);
        // ------------------  find h n and e vectors   ----------------
        var hbar = Satjs.cross(r, v);
        var magh = Satjs.mag(hbar);
        if (magh > small) {
            nbar[0] = -hbar[1];
            nbar[1] = hbar[0];
            nbar[2] = 0.0;
            magn = Satjs.mag(nbar);
            c1 = magv * magv - mus / magr;
            rdotv = Satjs.dot(r, v);
            for (i = 0; i <= 2; i++)
                ebar[i] = (c1 * r[i] - rdotv * v[i]) / mus;
            ecc = Satjs.mag(ebar);
            // ------------  find a e and semi-latus rectum   ----------
            sme = magv * magv * 0.5 - mus / magr;
            if (Math.abs(sme) > small)
                a = -mus / (2.0 * sme);
            else
                a = infinite;
            p = (magh * magh) / mus;
            // -----------------  find inclination   -------------------
            hk = hbar[2] / magh;
            incl = Math.acos(hk);
            // --------  determine type of orbit for later use  --------
            // ------ elliptical, parabolic, hyperbolic inclined -------
            typeorbit = 1;
            if (ecc < small) {
                // ----------------  circular equatorial ---------------
                if (incl < small || Math.abs(incl - PI) < small) {
                    typeorbit = 2;
                }
                else {
                    // --------------  circular inclined ---------------
                    typeorbit = 3;
                }
            }
            else {
                // - elliptical, parabolic, hyperbolic equatorial --
                if (incl < small || Math.abs(incl - PI) < small) {
                    typeorbit = 4;
                }
            }
            // ----------  find right ascension of the ascending node ------------
            if (magn > small) {
                temp = nbar[0] / magn;
                if (Math.abs(temp) > 1.0)
                    temp = Satjs.sgn(temp);
                omega = Math.acos(temp);
                if (nbar[1] < 0.0)
                    omega = TAU - omega;
            }
            else
                omega = unknown;
            // ---------------- find argument of perigee ---------------
            if (typeorbit == 1) {
                argp = Satjs.angle(nbar, ebar);
                if (ebar[2] < 0.0)
                    argp = TAU - argp;
            }
            else
                argp = unknown;
            // ------------  find true anomaly at epoch    -------------
            if (typeorbit == 1 || typeorbit == 4) {
                nu = Satjs.angle(ebar, r);
                if (rdotv < 0.0)
                    nu = TAU - nu;
            }
            else
                nu = unknown;
            // ----  find argument of latitude - circular inclined -----
            if (typeorbit == 3) {
                arglat = Satjs.angle(nbar, r);
                if (r[2] < 0.0)
                    arglat = TAU - arglat;
                m = arglat;
            }
            else
                arglat = unknown;
            if (ecc > small && typeorbit == 4) {
                temp = ebar[0] / ecc;
                if (Math.abs(temp) > 1.0)
                    temp = Satjs.sgn(temp);
                lonper = Math.acos(temp);
                if (ebar[1] < 0.0)
                    lonper = TAU - lonper;
                if (incl > halfpi)
                    lonper = TAU - lonper;
            }
            else
                lonper = unknown;
            // -------- find true longitude - circular equatorial ------
            if (magr > small && typeorbit == 2) {
                temp = r[0] / magr;
                if (Math.abs(temp) > 1.0)
                    temp = Satjs.sgn(temp);
                truelon = Math.acos(temp);
                if (r[1] < 0.0)
                    truelon = TAU - truelon;
                if (incl > halfpi)
                    truelon = TAU - truelon;
                m = truelon;
            }
            else
                truelon = unknown;
            // ------------ find mean anomaly for all orbits -----------
            if (typeorbit == 1 || typeorbit == 4)
                m = Satjs.newtonnu(ecc, nu).m;
        }
        else {
            p = unknown;
            a = unknown;
            ecc = unknown;
            incl = unknown;
            omega = unknown;
            argp = unknown;
            nu = unknown;
            m = unknown;
            arglat = unknown;
            truelon = unknown;
            lonper = unknown;
        }
        return {
            p: p,
            a: a,
            ecc: ecc,
            incl: incl,
            omega: omega,
            argp: argp,
            nu: nu,
            m: m,
            arglat: arglat,
            truelon: truelon,
            lonper: lonper,
        };
    }; // rv2coe
    /* -----------------------------------------------------------------------------
     *
     *                           procedure jday
     *
     *  this procedure finds the julian date given the year, month, day, and time.
     *    the julian date is defined by each elapsed day since noon, jan 1, 4713 bc.
     *
     *  algorithm     : calculate the answer in one step for efficiency
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    year        - year                           1900 .. 2100
     *    mon         - month                          1 .. 12
     *    day         - day                            1 .. 28,29,30,31
     *    hr          - universal time hour            0 .. 23
     *    min         - universal time min             0 .. 59
     *    sec         - universal time sec             0.0 .. 59.999
     *
     *  outputs       :
     *    jd          - julian date                    days from 4713 bc
     *    jdfrac      - julian date fraction into day  days from 4713 bc
     *
     *  locals        :
     *    none.
     *
     *  coupling      :
     *    none.
     *
     *  references    :
     *    vallado       2013, 183, alg 14, ex 3-4
     *
     * --------------------------------------------------------------------------- */
    Satjs.jday = function (year, mon, day, hr, minute, sec) {
        var jd = 367.0 * year -
            Math.floor(7 * (year + Math.floor((mon + 9) / 12.0)) * 0.25) +
            Math.floor((275 * mon) / 9.0) +
            day +
            1721013.5; // use - 678987.0 to go to mjd directly
        var jdFrac = (sec + minute * 60.0 + hr * 3600.0) / 86400.0;
        // check that the day and fractional day are correct
        if (Math.abs(jdFrac) > 1.0) {
            var dtt = Math.floor(jdFrac);
            jd = jd + dtt;
            jdFrac = jdFrac - dtt;
        }
        // - 0.5*sgn(100.0*year + mon - 190002.5) + 0.5;
        return { jd: jd, jdFrac: jdFrac };
    }; // jday
    /* -----------------------------------------------------------------------------
     *
     *                           procedure days2mdhms
     *
     *  this procedure converts the day of the year, days, to the equivalent month
     *    day, hour, minute and second.
     *
     *  algorithm     : set up array for the number of days per month
     *                  find leap year - use 1900 because 2000 is a leap year
     *                  loop through a temp value while the value is < the days
     *                  perform int conversions to the correct day and month
     *                  convert remainder into h m s using type conversions
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    year        - year                           1900 .. 2100
     *    days        - julian day of the year         0.0  .. 366.0
     *
     *  outputs       :
     *    mon         - month                          1 .. 12
     *    day         - day                            1 .. 28,29,30,31
     *    hr          - hour                           0 .. 23
     *    min         - minute                         0 .. 59
     *    sec         - second                         0.0 .. 59.999
     *
     *  locals        :
     *    dayofyr     - day of year
     *    temp        - temporary extended values
     *    inttemp     - temporary int value
     *    i           - index
     *    lmonth[13]  - int array containing the number of days per month
     *
     *  coupling      :
     *    none.
     * --------------------------------------------------------------------------- */
    Satjs.days2mdhms = function (year, days) {
        lmonth = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        dayofyr = Math.floor(days);
        //  ----------------- find month and day of month ----------------
        /** Satjs -- Incorporated in the above declaration */
        // if ((year % 4) == 0)
        // lmonth[2] = 29;
        i = 1;
        inttemp = 0;
        while (dayofyr > inttemp + lmonth[i - 1] && i < 12) {
            inttemp += lmonth[i - 1];
            i += 1;
        }
        mon = i;
        day = dayofyr - inttemp;
        //  ----------------- find hours minutes and seconds -------------
        temp = (days - dayofyr) * 24.0;
        hr = Math.floor(temp);
        temp = (temp - hr) * 60.0;
        minute = Math.floor(temp);
        sec = (temp - minute) * 60.0;
        return {
            mon: mon,
            day: day,
            hr: hr,
            minute: minute,
            sec: sec,
        };
    }; // days2mdhms
    /* -----------------------------------------------------------------------------
     *
     *                           procedure invjday
     *
     *  this procedure finds the year, month, day, hour, minute and second
     *  given the julian date. tu can be ut1, tdt, tdb, etc.
     *
     *  algorithm     : set up starting values
     *                  find leap year - use 1900 because 2000 is a leap year
     *                  find the elapsed days through the year in a loop
     *                  call routine to find each individual value
     *
     *  author        : david vallado                  719-573-2600    1 mar 2001
     *
     *  inputs          description                    range / units
     *    jd          - julian date                    days from 4713 bc
     *    jdfrac      - julian date fraction into day  days from 4713 bc
     *
     *  outputs       :
     *    year        - year                           1900 .. 2100
     *    mon         - month                          1 .. 12
     *    day         - day                            1 .. 28,29,30,31
     *    hr          - hour                           0 .. 23
     *    min         - minute                         0 .. 59
     *    sec         - second                         0.0 .. 59.999
     *
     *  locals        :
     *    days        - day of year plus fractional
     *                  portion of a day               days
     *    tu          - julian centuries from 0 h
     *                  jan 0, 1900
     *    temp        - temporary double values
     *    leapyrs     - number of leap years from 1900
     *
     *  coupling      :
     *    days2mdhms  - finds month, day, hour, minute and second given days and year
     *
     *  references    :
     *    vallado       2013, 203, alg 22, ex 3-13
     * --------------------------------------------------------------------------- */
    Satjs.invjday = function (jd, jdfrac) {
        var leapyrs;
        var days;
        // check jdfrac for multiple days
        if (Math.abs(jdfrac) >= 1.0) {
            jd = jd + Math.floor(jdfrac);
            jdfrac = jdfrac - Math.floor(jdfrac);
        }
        // check for fraction of a day included in the jd
        var dt = jd - Math.floor(jd) - 0.5;
        if (Math.abs(dt) > 0.00000001) {
            jd = jd - dt;
            jdfrac = jdfrac + dt;
        }
        /* --------------- find year and days of the year --------------- */
        var temp = jd - 2415019.5;
        var tu = temp / 365.25;
        year = 1900 + Math.floor(tu);
        leapyrs = Math.floor((year - 1901) * 0.25);
        days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));
        /* ------------ check for case of beginning of a year ----------- */
        if (days + jdfrac < 1.0) {
            year = year - 1;
            leapyrs = Math.floor((year - 1901) * 0.25);
            days = Math.floor(temp - ((year - 1900) * 365.0 + leapyrs));
        }
        /* ----------------- find remaining data  ------------------------- */
        var _a = Satjs.days2mdhms(year, days + jdfrac), mon = _a.mon, day = _a.day, hr = _a.hr, minute = _a.minute, sec = _a.sec;
        return {
            year: year,
            mon: mon,
            day: day,
            hr: hr,
            minute: minute,
            sec: sec,
        };
    }; // invjday
    return Satjs;
}());
exports.Satjs = Satjs;
