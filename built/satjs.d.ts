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
interface SatelliteRecord {
    a: number;
    am: number;
    alta: number;
    altp: number;
    argpdot: number;
    argpo: number;
    aycof: number;
    bstar: number;
    cc1: number;
    cc4: number;
    cc5: number;
    con41: number;
    d2: number;
    d3: number;
    d4: number;
    d5232: number;
    d5421: number;
    d5433: number;
    dedt: number;
    delmo: number;
    del1: number;
    ecco: number;
    em: number;
    epochdays: number;
    epochyr: number;
    error: number;
    eta: number;
    gsto: number;
    im: number;
    inclo: number;
    init: string;
    isimp: number;
    jdsatepoch: number;
    mdot: number;
    method: string;
    mo: number;
    mm: number;
    nddot: number;
    ndot: number;
    no: number;
    nodecf: number;
    nodedot: number;
    nodeo: number;
    om: number;
    Om: number;
    omgcof: number;
    operationmode: string;
    satnum: string;
    sinmao: number;
    t: number;
    t2cof: number;
    t3cof: number;
    t4cof: number;
    t5cof: number;
    x1mth2: number;
    x7thm1: number;
    xlcof: number;
    xmcof: number;
    xfact: number;
    xlamo: number;
    xli: number;
    xgh4: number;
    xgh3: number;
    xh2: number;
    xi2: number;
    xi3: number;
    xl2: number;
    xl3: number;
    xl4: number;
    zmol: number;
    zmos: number;
    dmdt: number;
    dnodt: number;
    domdt: number;
    e3: number;
    ee2: number;
    peo: number;
    pgho: number;
    pho: number;
    PInco: number;
    plo: number;
    se2: number;
    se3: number;
    sgh2: number;
    sgh3: number;
    sgh4: number;
    sh2: number;
    sh3: number;
    si2: number;
    si3: number;
    sl2: number;
    sl3: number;
    sl4: number;
    xgh2: number;
    xh3: number;
    tumin: number;
    radiusearthkm: number;
    irez: number;
    d3210: number;
    d3222: number;
    d4410: number;
    d4422: number;
    d5220: number;
    del2: number;
    del3: number;
    didt: number;
    atime: number;
    j2: number;
    j3: number;
    j4: number;
    mus: number;
    xke: number;
    j3oj2: number;
    xni: number;
    d2201: number;
    d2211: number;
    nm: number;
}
interface StateVector {
    position: {
        x: number;
        y: number;
        z: number;
    } | boolean;
    velocity: {
        x: number;
        y: number;
        z: number;
    } | boolean;
}
declare type vec3 = [number, number, number];
declare class Satjs {
    static dpper(satrec: SatelliteRecord, options: {
        ep: number;
        inclp: number;
        nodep: number;
        argpp: number;
        mp: number;
        opsmode: string;
        init: string;
    }): {
        ep: number;
        inclp: number;
        nodep: number;
        argpp: number;
        mp: number;
    };
    static dscom(options: {
        epoch: number;
        ep: number;
        argpp: number;
        tc: number;
        inclp: number;
        nodep: number;
        np: number;
    }): {
        snodm: number;
        cnodm: number;
        sinim: number;
        cosim: number;
        sinomm: number;
        cosomm: number;
        day: number;
        e3: number;
        ee2: number;
        em: number;
        emsq: number;
        gam: number;
        peo: number;
        pgho: number;
        pho: number;
        PInco: number;
        plo: number;
        rtemsq: number;
        se2: number;
        se3: number;
        sgh2: number;
        sgh3: number;
        sgh4: number;
        sh2: number;
        sh3: number;
        si2: number;
        si3: number;
        sl2: number;
        sl3: number;
        sl4: number;
        s1: number;
        s2: number;
        s3: number;
        s4: number;
        s5: number;
        s6: number;
        s7: number;
        ss1: number;
        ss2: number;
        ss3: number;
        ss4: number;
        ss5: number;
        ss6: number;
        ss7: number;
        sz1: number;
        sz2: number;
        sz3: number;
        sz11: number;
        sz12: number;
        sz13: number;
        sz21: number;
        sz22: number;
        sz23: number;
        sz31: number;
        sz32: number;
        sz33: number;
        xgh2: number;
        xgh3: number;
        xgh4: number;
        xh2: number;
        xh3: number;
        xi2: number;
        xi3: number;
        xl2: number;
        xl3: number;
        xl4: number;
        nm: number;
        z1: number;
        z2: number;
        z3: number;
        z11: number;
        z12: number;
        z13: number;
        z21: number;
        z22: number;
        z23: number;
        z31: number;
        z32: number;
        z33: number;
        zmol: number;
        zmos: number;
    };
    static dsinit(options: {
        xke: number;
        cosim: number;
        argpo: number;
        s1: number;
        s2: number;
        s3: number;
        s4: number;
        s5: number;
        sinim: number;
        ss1: number;
        ss2: number;
        ss3: number;
        ss4: number;
        ss5: number;
        sz1: number;
        sz3: number;
        sz11: number;
        sz13: number;
        sz21: number;
        sz23: number;
        sz31: number;
        sz33: number;
        t: number;
        tc: number;
        gsto: number;
        mo: number;
        mdot: number;
        no: number;
        nodeo: number;
        nodedot: number;
        xPIdot: number;
        z1: number;
        z3: number;
        z11: number;
        z13: number;
        z21: number;
        z23: number;
        z31: number;
        z33: number;
        ecco: number;
        eccsq: number;
        emsq: number;
        em: number;
        argpm: number;
        inclm: number;
        mm: number;
        nm: number;
        nodem: number;
        irez: number;
        atime: number;
        d2201: number;
        d2211: number;
        d3210: number;
        d3222: number;
        d4410: number;
        d4422: number;
        d5220: number;
        d5232: number;
        d5421: number;
        d5433: number;
        dedt: number;
        didt: number;
        dmdt: number;
        dnodt: number;
        domdt: number;
        del1: number;
        del2: number;
        del3: number;
        xfact: number;
        xlamo: number;
        xli: number;
        xni: number;
    }): {
        em: number;
        argpm: number;
        inclm: number;
        mm: number;
        nm: number;
        nodem: number;
        irez: number;
        atime: number;
        d2201: number;
        d2211: number;
        d3210: number;
        d3222: number;
        d4410: number;
        d4422: number;
        d5220: number;
        d5232: number;
        d5421: number;
        d5433: number;
        dedt: number;
        didt: number;
        dmdt: number;
        dndt: number;
        dnodt: number;
        domdt: number;
        del1: number;
        del2: number;
        del3: number;
        xfact: number;
        xlamo: number;
        xli: number;
        xni: number;
    };
    static dspace(options: {
        irez: number;
        d2201: number;
        d2211: number;
        d3210: number;
        d3222: number;
        d4410: number;
        d4422: number;
        d5220: number;
        d5232: number;
        d5421: number;
        d5433: number;
        dedt: number;
        del1: number;
        del2: number;
        del3: number;
        didt: number;
        dmdt: number;
        dnodt: number;
        domdt: number;
        argpo: number;
        argpdot: number;
        t: number;
        tc: number;
        gsto: number;
        xfact: number;
        xlamo: number;
        no: number;
        atime: number;
        em: number;
        argpm: number;
        inclm: number;
        xli: number;
        mm: number;
        xni: number;
        nodem: number;
        nm: number;
    }): {
        atime: number;
        em: number;
        argpm: number;
        inclm: number;
        xli: number;
        mm: number;
        xni: number;
        nodem: number;
        dndt: number;
        nm: number;
    };
    static initl(options: {
        opsmode: string;
        ecco: number;
        epoch: number;
        inclo: number;
        xke: number;
        j2: number;
        no: number;
    }): {
        no: number;
        method: string;
        ainv: number;
        ao: number;
        con41: number;
        con42: number;
        cosio: number;
        cosio2: number;
        eccsq: number;
        omeosq: number;
        posq: number;
        rp: number;
        rteosq: number;
        sinio: number;
        gsto: number;
    };
    static sgp4init(satrec: SatelliteRecord, options?: {
        whichconst?: string;
        opsmode?: string;
        satn?: string;
        epoch: number;
        xbstar: number;
        xecco: number;
        xargpo: number;
        xinclo: number;
        xndot: number;
        xnddot: number;
        xmo: number;
        xno: number;
        xnodeo: number;
    }): void;
    static sgp4(satrec: SatelliteRecord, tsince: number): StateVector;
    static getgravconst(whichconst: string): {
        tumin: number;
        mus: number;
        radiusearthkm: number;
        xke: number;
        j2: number;
        j3: number;
        j4: number;
        j3oj2: number;
    };
    static twoline2rv(tleLine1: string, tleLine2: string, whichconst?: string, opsmode?: string): SatelliteRecord;
    static gstime(jdut1: number): number;
    static sgn(x: number): number;
    static mag(x: vec3): number;
    static cross(vec1: vec3, vec2: vec3): vec3;
    static dot(x: vec3, y: vec3): number;
    static angle(vec1: vec3, vec2: vec3): number;
    static asinh(xval: number): number;
    static newtonnu(ecc: number, nu: number): {
        e0: number;
        m: number;
    };
    static sinh(x: number): number;
    static rv2coe(r: vec3, v: vec3, mus: number): {
        p: number;
        a: number;
        ecc: number;
        incl: number;
        omega: number;
        argp: number;
        nu: number;
        m: number;
        arglat: number;
        truelon: number;
        lonper: number;
    };
    static jday(year: number, mon: number, day: number, hr: number, minute: number, sec: number): {
        jd: number;
        jdFrac: number;
    };
    static days2mdhms(year: number, days: number): {
        mon: number;
        day: number;
        hr: number;
        minute: number;
        sec: number;
    };
    static invjday(jd: number, jdfrac: number): {
        year: number;
        mon: number;
        day: number;
        hr: number;
        minute: number;
        sec: number;
    };
}
export { Satjs };
