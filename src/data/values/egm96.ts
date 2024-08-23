/**
 * @author @thkruz Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2020-2024 Theodore Kruczek
 *
 * Orbital Object ToolKit is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Orbital Object ToolKit is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * Orbital Object ToolKit. If not, see <http://www.gnu.org/licenses/>.
 */

import { Egm96Entry } from './Egm96Data.js';

// / The first degree 36 EGM-96 normalized coefficients.
export const egm96 = <Egm96Entry[]>[
  [2, 0, -0.000484165371736, 0],
  [2, 1, -1.86987635955e-10, 1.19528012031e-9],
  [2, 2, 0.00000243914352398, -0.00000140016683654],
  [3, 0, 9.57254173792e-7, 0],
  [3, 1, 0.00000202998882184, 2.48513158716e-7],
  [3, 2, 9.04627768605e-7, -6.19025944205e-7],
  [3, 3, 7.21072657057e-7, 0.00000141435626958],
  [4, 0, 5.39873863789e-7, 0],
  [4, 1, -5.36321616971e-7, -4.73440265853e-7],
  [4, 2, 3.50694105785e-7, 6.6267157254e-7],
  [4, 3, 9.90771803829e-7, -2.00928369177e-7],
  [4, 4, -1.88560802735e-7, 3.08853169333e-7],
  [5, 0, 6.8532347563e-8, 0],
  [5, 1, -6.21012128528e-8, -9.44226127525e-8],
  [5, 2, 6.52438297612e-7, -3.23349612668e-7],
  [5, 3, -4.51955406071e-7, -2.14847190624e-7],
  [5, 4, -2.95301647654e-7, 4.96658876769e-8],
  [5, 5, 1.74971983203e-7, -6.69384278219e-7],
  [6, 0, -1.49957994714e-7, 0],
  [6, 1, -7.60879384947e-8, 2.62890545501e-8],
  [6, 2, 4.81732442832e-8, -3.73728201347e-7],
  [6, 3, 5.71730990516e-8, 9.02694517163e-9],
  [6, 4, -8.62142660109e-8, -4.71408154267e-7],
  [6, 5, -2.6713332549e-7, -5.36488432483e-7],
  [6, 6, 9.67616121092e-9, -2.37192006935e-7],
  [7, 0, 9.0978937145e-8, 0],
  [7, 1, 2.79872910488e-7, 9.54336911867e-8],
  [7, 2, 3.29743816488e-7, 9.30667596042e-8],
  [7, 3, 2.50398657706e-7, -2.17198608738e-7],
  [7, 4, -2.75114355257e-7, -1.23800392323e-7],
  [7, 5, 1.93765507243e-9, 1.77377719872e-8],
  [7, 6, -3.58856860645e-7, 1.51789817739e-7],
  [7, 7, 1.09185148045e-9, 2.44415707993e-8],
  [8, 0, 4.96711667324e-8, 0],
  [8, 1, 2.33422047893e-8, 5.90060493411e-8],
  [8, 2, 8.02978722615e-8, 6.54175425859e-8],
  [8, 3, -1.91877757009e-8, -8.63454445021e-8],
  [8, 4, -2.44600105471e-7, 7.00233016934e-8],
  [8, 5, -2.55352403037e-8, 8.91462164788e-8],
  [8, 6, -6.57361610961e-8, 3.09238461807e-7],
  [8, 7, 6.72811580072e-8, 7.47440473633e-8],
  [8, 8, -1.24092493016e-7, 1.20533165603e-7],
  [9, 0, 2.76714300853e-8, 0],
  [9, 1, 1.43387502749e-7, 2.16834947618e-8],
  [9, 2, 2.22288318564e-8, -3.22196647116e-8],
  [9, 3, -1.60811502143e-7, -7.42287409462e-8],
  [9, 4, -9.00179225336e-9, 1.94666779475e-8],
  [9, 5, -1.66165092924e-8, -5.41113191483e-8],
  [9, 6, 6.26941938248e-8, 2.22903525945e-7],
  [9, 7, -1.18366323475e-7, -9.65152667886e-8],
  [9, 8, 1.88436022794e-7, -3.08566220421e-9],
  [9, 9, -4.77475386132e-8, 9.66412847714e-8],
  [10, 0, 5.26222488569e-8, 0],
  [10, 1, 8.35115775652e-8, -1.31314331796e-7],
  [10, 2, -9.42413882081e-8, -5.1579165739e-8],
  [10, 3, -6.89895048176e-9, -1.53768828694e-7],
  [10, 4, -8.40764549716e-8, -7.92806255331e-8],
  [10, 5, -4.93395938185e-8, -5.05370221897e-8],
  [10, 6, -3.75885236598e-8, -7.95667053872e-8],
  [10, 7, 8.11460540925e-9, -3.36629641314e-9],
  [10, 8, 4.04927981694e-8, -9.18705975922e-8],
  [10, 9, 1.25491334939e-7, -3.76516222392e-8],
  [10, 10, 1.00538634409e-7, -2.4014844952e-8],
  [11, 0, -5.09613707522e-8, 0],
  [11, 1, 1.51687209933e-8, -2.68604146166e-8],
  [11, 2, 1.86309749878e-8, -9.90693862047e-8],
  [11, 3, -3.09871239854e-8, -1.4813180426e-7],
  [11, 4, -3.89580205051e-8, -6.3666651198e-8],
  [11, 5, 3.77848029452e-8, 4.94736238169e-8],
  [11, 6, -1.18676592395e-9, 3.44769584593e-8],
  [11, 7, 4.11565188074e-9, -8.98252808977e-8],
  [11, 8, -5.984108413e-9, 2.43989612237e-8],
  [11, 9, -3.14231072723e-8, 4.17731829829e-8],
  [11, 10, -5.21882681927e-8, -1.83364561788e-8],
  [11, 11, 4.60344448746e-8, -6.96662308185e-8],
  [12, 0, 3.77252636558e-8, 0],
  [12, 1, -5.40654977836e-8, -4.35675748979e-8],
  [12, 2, 1.42979642253e-8, 3.20975937619e-8],
  [12, 3, 3.93995876403e-8, 2.44264863505e-8],
  [12, 4, -6.86908127934e-8, 4.15081109011e-9],
  [12, 5, 3.0941112873e-8, 7.82536279033e-9],
  [12, 6, 3.41523275208e-9, 3.91765484449e-8],
  [12, 7, -1.86909958587e-8, 3.56131849382e-8],
  [12, 8, -2.53769398865e-8, 1.69361024629e-8],
  [12, 9, 4.22880630662e-8, 2.52692598301e-8],
  [12, 10, -6.17619654902e-9, 3.08375794212e-8],
  [12, 11, 1.12502994122e-8, -6.37946501558e-9],
  [12, 12, -2.4953260739e-9, -1.117806019e-8],
  [13, 0, 4.22982206413e-8, 0],
  [13, 1, -5.13569699124e-8, 3.90510386685e-8],
  [13, 2, 5.59217667099e-8, -6.27337565381e-8],
  [13, 3, -2.19360927945e-8, 9.74829362237e-8],
  [13, 4, -3.13762599666e-9, -1.19627874492e-8],
  [13, 5, 5.90049394905e-8, 6.64975958036e-8],
  [13, 6, -3.59038073075e-8, -6.57280613686e-9],
  [13, 7, 2.53002147087e-9, -6.21470822331e-9],
  [13, 8, -9.83150822695e-9, -1.04740222825e-8],
  [13, 9, 2.47325771791e-8, 4.52870369936e-8],
  [13, 10, 4.1032465393e-8, -3.6812102948e-8],
  [13, 11, -4.43869677399e-8, -4.76507804288e-9],
  [13, 12, -3.12622200222e-8, 8.78405809267e-8],
  [13, 13, -6.12759553199e-8, 6.85261488594e-8],
  [14, 0, -2.42786502921e-8, 0],
  [14, 1, -1.86968616381e-8, 2.94747542249e-8],
  [14, 2, -3.67789379502e-8, -5.16779392055e-9],
  [14, 3, 3.58875097333e-8, 2.04618827833e-8],
  [14, 4, 1.83865617792e-9, -2.26780613566e-8],
  [14, 5, 2.87344273542e-8, -1.63882249728e-8],
  [14, 6, -1.94810485574e-8, 2.47831272781e-9],
  [14, 7, 3.75003839415e-8, -4.17291319429e-9],
  [14, 8, -3.50946485865e-8, -1.53515265203e-8],
  [14, 9, 3.20284939341e-8, 2.88804922064e-8],
  [14, 10, 3.90329180008e-8, -1.44308452469e-9],
  [14, 11, 1.53970516502e-8, -3.90548173245e-8],
  [14, 12, 8.40829163869e-9, -3.11327189117e-8],
  [14, 13, 3.22147043964e-8, 4.5189722496e-8],
  [14, 14, -5.18980794309e-8, -4.81506636748e-9],
  [15, 0, 1.47910068708e-9, 0],
  [15, 1, 1.00817268177e-8, 1.09773066324e-8],
  [15, 2, -2.13942673775e-8, -3.08914875777e-8],
  [15, 3, 5.21392929041e-8, 1.72892926103e-8],
  [15, 4, -4.08150084078e-8, 6.50174707794e-9],
  [15, 5, 1.24935723108e-8, 8.08375563996e-9],
  [15, 6, 3.31211643896e-8, -3.68246004304e-8],
  [15, 7, 5.96210699259e-8, 5.31841171879e-9],
  [15, 8, -3.22428691498e-8, 2.21523579587e-8],
  [15, 9, 1.28788268085e-8, 3.75629820829e-8],
  [15, 10, 1.04688722521e-8, 1.47222147015e-8],
  [15, 11, -1.11675061934e-9, 1.80996198432e-8],
  [15, 12, -3.23962134415e-8, 1.55243104746e-8],
  [15, 13, -2.83933019117e-8, -4.22066791103e-9],
  [15, 14, 5.1916885933e-9, -2.43752739666e-8],
  [15, 15, -1.90930538322e-8, -4.71139421558e-9],
  [16, 0, -3.15322986722e-9, 0],
  [16, 1, 2.58360856231e-8, 3.25447560859e-8],
  [16, 2, -2.33671404512e-8, 2.88799363439e-8],
  [16, 3, -3.36019429391e-8, -2.2041898801e-8],
  [16, 4, 4.02316284314e-8, 4.83837716909e-8],
  [16, 5, -1.29501939245e-8, -3.19458578129e-9],
  [16, 6, 1.40239252323e-8, -3.50760208303e-8],
  [16, 7, -7.08412635136e-9, -8.81581561131e-9],
  [16, 8, -2.09018868094e-8, 5.0052739053e-9],
  [16, 9, -2.18588720643e-8, -3.95012419994e-8],
  [16, 10, -1.17529900814e-8, 1.14211582961e-8],
  [16, 11, 1.87574042592e-8, -3.03161919925e-9],
  [16, 12, 1.95400194038e-8, 6.66983574071e-9],
  [16, 13, 1.38196369576e-8, 1.02778499508e-9],
  [16, 14, -1.93182168856e-8, -3.86174893776e-8],
  [16, 15, -1.45149060142e-8, -3.27443078739e-8],
  [16, 16, -3.79671710746e-8, 3.02155372655e-9],
  [17, 0, 1.97605066395e-8, 0],
  [17, 1, -2.54177575118e-8, -3.06630529689e-8],
  [17, 2, -1.95988656721e-8, 6.4926589341e-9],
  [17, 3, 5.64123066224e-9, 6.78327095529e-9],
  [17, 4, 7.07457075637e-9, 2.49437600834e-8],
  [17, 5, -1.54987006052e-8, 6.60021551851e-9],
  [17, 6, -1.18194012847e-8, -2.89770975177e-8],
  [17, 7, 2.42149702381e-8, -4.22222973697e-9],
  [17, 8, 3.88442097559e-8, 3.58904095943e-9],
  [17, 9, 3.81356493231e-9, -2.81466943714e-8],
  [17, 10, -3.88216085542e-9, 1.81328176508e-8],
  [17, 11, -1.57356600363e-8, 1.06560649404e-8],
  [17, 12, 2.88013010655e-8, 2.03450136084e-8],
  [17, 13, 1.65503425731e-8, 2.04667531435e-8],
  [17, 14, -1.41983872649e-8, 1.14948025244e-8],
  [17, 15, 5.42100361657e-9, 5.32610369811e-9],
  [17, 16, -3.01992205043e-8, 3.65331918531e-9],
  [17, 17, -3.43086856041e-8, -1.98523455381e-8],
  [18, 0, 5.08691038332e-9, 0],
  [18, 1, 7.21098449649e-9, -3.88714473013e-8],
  [18, 2, 1.40631771205e-8, 1.00093396253e-8],
  [18, 3, -5.07232520873e-9, -4.90865931335e-9],
  [18, 4, 5.48759308217e-8, -1.3526711772e-9],
  [18, 5, 5.48710485555e-9, 2.64338629459e-8],
  [18, 6, 1.46570755271e-8, -1.36438019951e-8],
  [18, 7, 6.75812328417e-9, 6.88577494235e-9],
  [18, 8, 3.07619845144e-8, 4.17827734107e-9],
  [18, 9, -1.8847060188e-8, 3.68302736953e-8],
  [18, 10, 5.27535358934e-9, -4.66091535881e-9],
  [18, 11, -7.2962851896e-9, 1.9521520802e-9],
  [18, 12, -2.97449412422e-8, -1.64497878395e-8],
  [18, 13, -6.27919717152e-9, -3.48383939938e-8],
  [18, 14, -8.1560533641e-9, -1.28636585027e-8],
  [18, 15, -4.05003412879e-8, -2.02684998021e-8],
  [18, 16, 1.04141042028e-8, 6.61468817624e-9],
  [18, 17, 3.58771586841e-9, 4.48065587564e-9],
  [18, 18, 3.12351953717e-9, -1.09906032543e-8],
  [19, 0, -3.25780965394e-9, 0],
  [19, 1, -7.59903885319e-9, 1.26835472605e-9],
  [19, 2, 3.53541528655e-8, -1.31346303514e-9],
  [19, 3, -9.74103607309e-9, 1.50662259043e-9],
  [19, 4, 1.57039009057e-8, -7.61677383811e-9],
  [19, 5, 1.09629213379e-8, 2.83172176438e-8],
  [19, 6, -4.08745178658e-9, 1.86219430719e-8],
  [19, 7, 4.78275337044e-9, -7.172834559e-9],
  [19, 8, 2.9490836428e-8, -9.93037002883e-9],
  [19, 9, 3.07961427159e-9, 6.94110477214e-9],
  [19, 10, -3.38415069043e-8, -7.37981767136e-9],
  [19, 11, 1.60443652916e-8, 9.96673453483e-9],
  [19, 12, -2.47106581581e-9, 9.16852310642e-9],
  [19, 13, -7.4471737998e-9, -2.82584466742e-8],
  [19, 14, -4.70502589215e-9, -1.29526697983e-8],
  [19, 15, -1.76580549771e-8, -1.40350990039e-8],
  [19, 16, -2.16950096188e-8, -7.24534721567e-9],
  [19, 17, 2.90444936079e-8, -1.5345653107e-8],
  [19, 18, 3.48382199593e-8, -9.54146344917e-9],
  [19, 19, -2.5734934943e-9, 4.83151822363e-9],
  [20, 0, 2.22384610651e-8, 0],
  [20, 1, 5.16303125218e-9, 6.69626726966e-9],
  [20, 2, 1.98831128238e-8, 1.75183843257e-8],
  [20, 3, -3.62601436785e-9, 3.79590724141e-8],
  [20, 4, 2.42238118652e-9, -2.11057611874e-8],
  [20, 5, -1.07042562564e-8, -7.71860083169e-9],
  [20, 6, 1.1047483757e-8, -2.17720365898e-9],
  [20, 7, -2.10090282728e-8, -2.23491503969e-11],
  [20, 8, 4.42419185637e-9, 1.83035804593e-9],
  [20, 9, 1.78846216942e-8, -6.63940865358e-9],
  [20, 10, -3.25394919988e-8, -5.12308873621e-9],
  [20, 11, 1.38992707697e-8, -1.87706454942e-8],
  [20, 12, -6.3575060075e-9, 1.80260853103e-8],
  [20, 13, 2.75222725997e-8, 6.90887077588e-9],
  [20, 14, 1.15841169405e-8, -1.43176160143e-8],
  [20, 15, -2.60130744291e-8, -7.84379672413e-10],
  [20, 16, -1.24137147118e-8, -2.77500443628e-10],
  [20, 17, 4.3690966796e-9, -1.37420446198e-8],
  [20, 18, 1.51842883022e-8, -8.08429903142e-10],
  [20, 19, -3.14942002852e-9, 1.06505202245e-8],
  [20, 20, 4.01448327968e-9, -1.20450644785e-8],
  [21, 0, 5.87820252575e-9, 0],
  [21, 1, -1.61000670141e-8, 2.84359400791e-8],
  [21, 2, -6.54460482558e-9, 3.78474868508e-9],
  [21, 3, 1.9549199526e-8, 2.26286963716e-8],
  [21, 4, -5.76604339239e-9, 1.94493782631e-8],
  [21, 5, 2.58856303016e-9, 1.70850368669e-9],
  [21, 6, -1.40168810589e-8, -2.73814826381e-12],
  [21, 7, -8.64357168475e-9, 4.42612277119e-9],
  [21, 8, -1.70477278237e-8, 1.5071119263e-9],
  [21, 9, 1.64489062394e-8, 8.30113196365e-9],
  [21, 10, -1.09928976409e-8, -1.46913794684e-9],
  [21, 11, 6.99300364214e-9, -3.53590565124e-8],
  [21, 12, -3.19300109594e-9, 1.45786917947e-8],
  [21, 13, -1.8985452459e-8, 1.40514791436e-8],
  [21, 14, 2.03580785674e-8, 7.5577246284e-9],
  [21, 15, 1.75530220278e-8, 1.04533886832e-8],
  [21, 16, 7.86969109367e-9, -6.56089715279e-9],
  [21, 17, -6.99484489981e-9, -7.36064901147e-9],
  [21, 18, 2.59643291521e-8, -1.1156080613e-8],
  [21, 19, -2.7374163641e-8, 1.63958190052e-8],
  [21, 20, -2.68682473584e-8, 1.62086057168e-8],
  [21, 21, 8.30374873932e-9, -3.75546121742e-9],
  [22, 0, -1.13735124259e-8, 0],
  [22, 1, 1.62309865679e-8, -3.77303475153e-9],
  [22, 2, -2.64090261387e-8, -2.10832402428e-9],
  [22, 3, 1.1658001654e-8, 1.06764617222e-8],
  [22, 4, -2.70979141451e-9, 1.74980820565e-8],
  [22, 5, -1.8645262501e-9, 7.44718166476e-10],
  [22, 6, 9.64390704406e-9, -6.37316743908e-9],
  [22, 7, 1.59715981795e-8, 4.39600942993e-9],
  [22, 8, -2.35157426998e-8, 4.83673695086e-9],
  [22, 9, 8.29435796737e-9, 8.73382159986e-9],
  [22, 10, 6.00704037701e-9, 2.21854121109e-8],
  [22, 11, -4.96078301539e-9, -1.78822672474e-8],
  [22, 12, 2.13502315463e-9, -7.96120522503e-9],
  [22, 13, -1.72631843979e-8, 1.97026896892e-8],
  [22, 14, 1.09297133018e-8, 8.25280905301e-9],
  [22, 15, 2.58410840629e-8, 4.60172998318e-9],
  [22, 16, 1.41258558921e-10, -7.182380053e-9],
  [22, 17, 8.89294096846e-9, -1.45618348246e-8],
  [22, 18, 1.05047447464e-8, -1.64271275481e-8],
  [22, 19, 1.41305509124e-8, -3.84537168599e-9],
  [22, 20, -1.67617655441e-8, 1.99561513321e-8],
  [22, 21, -2.50948756455e-8, 2.36151346133e-8],
  [22, 22, -9.59596694809e-9, 2.49861413883e-9],
  [23, 0, -2.26201075082e-8, 0],
  [23, 1, 1.10870239758e-8, 1.6137915153e-8],
  [23, 2, -1.35191027779e-8, -5.01411714852e-9],
  [23, 3, -2.45128011445e-8, -1.60570438998e-8],
  [23, 4, -2.39887874558e-8, 7.31536362289e-9],
  [23, 5, 7.99636624146e-10, -1.6144974141e-10],
  [23, 6, -1.26082781309e-8, 1.61308155632e-8],
  [23, 7, -8.04132133762e-9, -1.11647197494e-9],
  [23, 8, 7.53785326469e-9, -3.2967992522e-10],
  [23, 9, 2.5505325495e-9, -1.28071525548e-8],
  [23, 10, 1.65167929134e-8, -1.85239620853e-9],
  [23, 11, 9.42656822725e-9, 1.52386181583e-8],
  [23, 12, 1.63632625535e-8, -1.24098327824e-8],
  [23, 13, -1.15107832808e-8, -4.84279171627e-9],
  [23, 14, 6.75321602206e-9, -1.82899962212e-9],
  [23, 15, 1.8689804286e-8, -3.60523754481e-9],
  [23, 16, 6.13840121864e-9, 1.10362707266e-8],
  [23, 17, -5.5372102391e-9, -1.2845906046e-8],
  [23, 18, 8.43361263813e-9, -1.49115921605e-8],
  [23, 19, -5.20848228342e-9, 1.07789593943e-8],
  [23, 20, 8.60434396837e-9, -5.34641639372e-9],
  [23, 21, 1.54578189867e-8, 1.15333325358e-8],
  [23, 22, -1.78417206471e-8, 4.33092348903e-9],
  [23, 23, 2.85393980111e-9, -1.1323294597e-8],
  [24, 0, 7.63657386411e-10, 0],
  [24, 1, -3.14943681427e-9, -1.77191190396e-9],
  [24, 2, 1.38595572093e-9, 1.711040664e-8],
  [24, 3, -4.76406913528e-9, -9.42329378125e-9],
  [24, 4, 6.05108036341e-9, 5.49769910191e-9],
  [24, 5, -7.2947904748e-9, -2.13826490504e-8],
  [24, 6, 4.54210367535e-9, 1.85596665318e-9],
  [24, 7, -6.14244489298e-9, 4.70081667951e-9],
  [24, 8, 1.54822444425e-8, -4.34472097787e-9],
  [24, 9, -9.76623425797e-9, -1.6275513762e-8],
  [24, 10, 1.08934628974e-8, 2.09168783608e-8],
  [24, 11, 1.45280775337e-8, 1.87398018797e-8],
  [24, 12, 1.18970310717e-8, -6.2293309815e-9],
  [24, 13, -2.89676673058e-9, 3.13251295024e-9],
  [24, 14, -2.00006558603e-8, -1.87249636821e-9],
  [24, 15, 6.10396350698e-9, -1.58957680563e-8],
  [24, 16, 8.88750753375e-9, 2.96492703352e-9],
  [24, 17, -1.19629964611e-8, -5.82074593955e-9],
  [24, 18, -6.52630641555e-10, -1.01332355837e-8],
  [24, 19, -4.38896550264e-9, -8.14552569977e-9],
  [24, 20, -5.17551981851e-9, 8.90354942378e-9],
  [24, 21, 6.03436755046e-9, 1.40116090741e-8],
  [24, 22, 3.93640283055e-9, -4.28327655754e-9],
  [24, 23, -6.1428347955e-9, -8.692679021e-9],
  [24, 24, 1.23903921309e-8, -3.75059286959e-9],
  [25, 0, 3.21309208115e-9, 0],
  [25, 1, 6.89649208567e-9, -7.995518294e-9],
  [25, 2, 2.19498139173e-8, 9.01370249111e-9],
  [25, 3, -1.17774931587e-8, -1.26719024392e-8],
  [25, 4, 9.4254362892e-9, 6.84937199311e-10],
  [25, 5, -1.00497487339e-8, -9.2212239967e-10],
  [25, 6, 1.66832871654e-8, 4.30583576199e-10],
  [25, 7, 7.71426681671e-9, -4.11703290425e-9],
  [25, 8, 3.1565194415e-9, -7.81960217669e-10],
  [25, 9, -2.99385350515e-8, 2.12695473199e-8],
  [25, 10, 8.81931818034e-9, -4.18041586166e-9],
  [25, 11, 1.2340148568e-9, 1.08069128123e-8],
  [25, 12, -7.65146786755e-9, 1.1747374286e-8],
  [25, 13, 8.32308127158e-9, -1.13072604626e-8],
  [25, 14, -1.97042124794e-8, 6.53183488635e-9],
  [25, 15, -4.35732052985e-9, -7.35147227573e-9],
  [25, 16, 9.18239548455e-10, -1.28124888592e-8],
  [25, 17, -1.52176535379e-8, -3.21280397924e-9],
  [25, 18, 1.21901534245e-9, -1.49040483259e-8],
  [25, 19, 7.77589111757e-9, 9.92518771941e-9],
  [25, 20, -7.50856670672e-9, -5.62826155305e-10],
  [25, 21, 1.0723284068e-8, 8.16090174381e-9],
  [25, 22, -1.39902235929e-8, 3.58546198324e-9],
  [25, 23, 8.40270853655e-9, -1.23338407961e-8],
  [25, 24, 4.12447134569e-9, -8.30716465317e-9],
  [25, 25, 1.07484366767e-8, 4.72369913984e-9],
  [26, 0, 5.05833635414e-9, 0],
  [26, 1, -1.54756177965e-9, -7.70012788871e-9],
  [26, 2, -3.58729876836e-9, 1.14484111182e-8],
  [26, 3, 1.40505671267e-8, 4.30905534294e-9],
  [26, 4, 1.90548709216e-8, -1.94161179658e-8],
  [26, 5, 1.07190025408e-8, 9.08952851813e-9],
  [26, 6, 1.13116909406e-8, -9.34393384449e-9],
  [26, 7, -1.562282956e-9, 4.81168302477e-9],
  [26, 8, 3.94920146317e-9, 1.153405253e-9],
  [26, 9, -1.20371433638e-8, 4.75177058134e-10],
  [26, 10, -1.41246124334e-8, -6.45217247294e-9],
  [26, 11, -5.20385857649e-9, 2.12443340407e-9],
  [26, 12, -1.75071176484e-8, 2.01974971938e-9],
  [26, 13, -3.35708835245e-11, 1.50474091686e-9],
  [26, 14, 7.96385051492e-9, 7.84704068835e-9],
  [26, 15, -1.32388781089e-8, 8.03960091442e-9],
  [26, 16, 1.29093226253e-9, -6.11434455706e-9],
  [26, 17, -1.24494157564e-8, 7.8077484564e-9],
  [26, 18, -1.30317424459e-8, 4.9998916257e-9],
  [26, 19, -2.05807464595e-9, 3.54396135438e-9],
  [26, 20, 6.55952144018e-9, -1.1687804118e-8],
  [26, 21, -8.70038868454e-9, 1.68222257564e-9],
  [26, 22, 1.01580452049e-8, 7.54358531576e-9],
  [26, 23, 1.24105057436e-9, 1.08580088935e-8],
  [26, 24, 8.58620351967e-9, 1.48288510099e-8],
  [26, 25, 3.93441578873e-9, -5.97792415806e-10],
  [26, 26, 3.93179749568e-10, 1.93894997772e-9],
  [27, 0, 2.7717632236e-9, 0],
  [27, 1, 2.48982909452e-9, 3.77378455357e-9],
  [27, 2, 1.45270146453e-9, 5.03113268026e-10],
  [27, 3, -3.62306812856e-10, 1.088457625e-8],
  [27, 4, -5.99191537157e-10, 9.40517681233e-9],
  [27, 5, 1.67690560888e-8, 1.38338587209e-8],
  [27, 6, 3.64265989803e-9, 6.13032807744e-9],
  [27, 7, -1.23459266009e-8, -3.86514075952e-9],
  [27, 8, -6.1040764482e-9, -8.99504471581e-9],
  [27, 9, 3.40113157078e-9, 1.10992938665e-8],
  [27, 10, -1.33158893187e-8, 1.72832279915e-10],
  [27, 11, 1.98322808107e-9, -9.69054254426e-9],
  [27, 12, -1.13695413044e-8, 1.90072943781e-9],
  [27, 13, -4.97224781272e-9, -4.14521559996e-9],
  [27, 14, 1.55033957088e-8, 1.1882128969e-8],
  [27, 15, -1.80057326196e-9, 1.1763698622e-9],
  [27, 16, 2.7572995289e-9, 2.78770269194e-9],
  [27, 17, 3.79281571763e-9, 3.14983101049e-10],
  [27, 18, -2.87144071715e-9, 7.44190558718e-9],
  [27, 19, -3.26518614707e-10, -2.93243500455e-9],
  [27, 20, -8.55182561846e-10, 3.47617208115e-9],
  [27, 21, 4.86877030983e-9, -7.0872528354e-9],
  [27, 22, -5.74332100084e-9, 2.90056687384e-9],
  [27, 23, -5.41033470941e-9, -1.10452433655e-8],
  [27, 24, 4.16951885933e-10, -1.80038186307e-9],
  [27, 25, 1.22815470212e-8, 5.62425137285e-9],
  [27, 26, -6.59498075164e-9, -2.22838418639e-9],
  [27, 27, 7.60067381059e-9, 6.9238741892e-10],
  [28, 0, -9.10376375863e-9, 0],
  [28, 1, -5.55484993587e-9, 7.9330019258e-9],
  [28, 2, -1.5189131211e-8, -7.97957089012e-9],
  [28, 3, 2.5318254224e-9, 1.11373049392e-8],
  [28, 4, -1.99212752126e-9, 1.25054704704e-8],
  [28, 5, 1.08871875702e-8, -4.22573826989e-9],
  [28, 6, -5.22194316032e-9, 1.32656509709e-8],
  [28, 7, -7.05588863746e-10, 5.12740997711e-9],
  [28, 8, -4.23704976329e-9, -3.32584474553e-9],
  [28, 9, 1.13842461859e-8, -1.04163010811e-8],
  [28, 10, -9.22867885082e-9, 8.17851851593e-9],
  [28, 11, -2.9809734257e-9, -1.45944538949e-9],
  [28, 12, -4.83471863256e-10, 9.64951845027e-9],
  [28, 13, 1.64993974957e-9, 6.63803768689e-9],
  [28, 14, -8.23334828619e-9, -1.26939492243e-8],
  [28, 15, -1.22774798187e-8, -1.97537366262e-9],
  [28, 16, -3.57280690709e-9, -1.35890044766e-8],
  [28, 17, 1.33742628184e-8, -4.72374226319e-9],
  [28, 18, 5.62532322748e-9, -3.87230727328e-9],
  [28, 19, 5.77104709635e-9, 2.35011734292e-8],
  [28, 20, -1.15922189521e-9, 6.62939940662e-9],
  [28, 21, 6.63154344375e-9, 6.33201211223e-9],
  [28, 22, -1.94231451662e-9, -7.33725263107e-9],
  [28, 23, 6.20158165102e-9, 2.61202437682e-9],
  [28, 24, 1.11186270621e-8, -1.35606378769e-8],
  [28, 25, 7.29495896149e-9, -1.76041477031e-8],
  [28, 26, 1.23084992259e-8, 3.89251843939e-9],
  [28, 27, -8.11971206724e-9, 1.3027922855e-9],
  [28, 28, 6.9872587832e-9, 6.80526167979e-9],
  [29, 0, -4.97406439473e-9, 0],
  [29, 1, 4.98979084585e-9, -9.82512461189e-9],
  [29, 2, -3.12119754621e-9, -2.63433487676e-9],
  [29, 3, 1.82518120454e-9, -1.05769977751e-8],
  [29, 4, -2.42786314995e-8, 2.26110758622e-9],
  [29, 5, -6.8110306367e-9, 6.01242555817e-9],
  [29, 6, 1.19592879211e-8, 9.7020069574e-9],
  [29, 7, -5.91100934209e-9, -2.14599788734e-9],
  [29, 8, -1.6946723555e-8, 1.11160276839e-8],
  [29, 9, -1.2937116169e-9, 1.41793573226e-9],
  [29, 10, 1.37184624798e-8, 1.79543486167e-9],
  [29, 11, -5.96272885876e-9, 6.33350180946e-9],
  [29, 12, -4.56278910357e-10, -5.01222008898e-9],
  [29, 13, -1.09095923049e-9, -2.34179014389e-9],
  [29, 14, -3.23718965114e-9, -4.58306325034e-9],
  [29, 15, -9.57359749406e-9, -6.77546725808e-9],
  [29, 16, 1.37450063496e-9, -1.4864526654e-8],
  [29, 17, -1.57662415501e-9, -3.92506699434e-9],
  [29, 18, -3.67597840865e-9, -2.58549575294e-9],
  [29, 19, -6.30046143533e-9, 5.86840708296e-9],
  [29, 20, -7.96446331531e-9, 5.74239983127e-9],
  [29, 21, -9.8726430286e-9, -5.51700601596e-9],
  [29, 22, 1.15574836058e-8, -1.47663300854e-9],
  [29, 23, -1.84576717899e-9, 2.63546763516e-9],
  [29, 24, 3.42199668119e-10, -2.38230581193e-9],
  [29, 25, 5.85864038329e-9, 8.68333958543e-9],
  [29, 26, 7.87039835357e-9, -6.92232980921e-9],
  [29, 27, -7.98313300841e-9, -1.01903214091e-9],
  [29, 28, 9.73355537526e-9, -5.71293958601e-9],
  [29, 29, 1.28224843767e-8, -5.01548480482e-9],
  [30, 0, 6.02882084759e-9, 0],
  [30, 1, -5.57556615596e-10, 1.24285275602e-9],
  [30, 2, -1.0370644769e-8, -2.61802322444e-9],
  [30, 3, 2.14692300603e-9, -1.36464188501e-8],
  [30, 4, -4.55090433473e-10, -3.91117213505e-9],
  [30, 5, -4.36973977446e-9, -5.35558974983e-9],
  [30, 6, 3.28451285815e-10, 3.17808233981e-9],
  [30, 7, 4.04923220309e-9, 1.83962458779e-9],
  [30, 8, 2.54952865236e-9, 4.62058281854e-9],
  [30, 9, -7.32592511128e-9, -9.7277817424e-9],
  [30, 10, 4.27609484555e-9, -4.10864961814e-9],
  [30, 11, -1.04043005227e-8, 1.07581457651e-8],
  [30, 12, 1.71622295302e-8, -1.08456775556e-8],
  [30, 13, 1.42173587056e-8, 2.96806226352e-9],
  [30, 14, 5.11505860834e-9, 8.07288811257e-9],
  [30, 15, 2.10512146846e-10, -1.04541123836e-9],
  [30, 16, -1.08921920457e-8, 4.35254063533e-9],
  [30, 17, -6.14382436271e-9, -6.03140938575e-9],
  [30, 18, -1.1114926509e-8, -7.65521957976e-9],
  [30, 19, -1.2967398433e-8, 2.42005669694e-9],
  [30, 20, -4.89261172033e-9, 1.27655684422e-8],
  [30, 21, -1.0628473781e-8, -5.97537587412e-9],
  [30, 22, -4.83763240001e-9, -9.37720111156e-9],
  [30, 23, 5.7411388543e-9, -1.03756082222e-8],
  [30, 24, -2.35238020789e-9, -2.7590933962e-9],
  [30, 25, 3.04426404856e-9, -1.54853389229e-8],
  [30, 26, 1.22149787623e-9, 1.24069551653e-8],
  [30, 27, -7.95063844863e-9, 1.27529431593e-8],
  [30, 28, -5.47120800289e-9, -7.96006293513e-9],
  [30, 29, 4.1592295424e-9, 1.89489104417e-9],
  [30, 30, 2.64794018006e-9, 8.12994755178e-9],
  [31, 0, 7.33100089318e-9, 0],
  [31, 1, 6.11169376734e-9, -1.60774540844e-8],
  [31, 2, 7.49625106123e-9, 6.37776322444e-9],
  [31, 3, -8.89920966189e-9, -7.6550294416e-9],
  [31, 4, 1.22555580723e-8, -4.94466436575e-9],
  [31, 5, -8.71279064045e-9, 3.08325747379e-9],
  [31, 6, -1.68890803585e-9, 1.3703621527e-9],
  [31, 7, -2.71996133536e-9, -6.8862512168e-10],
  [31, 8, -7.50260355354e-10, 2.28102724239e-9],
  [31, 9, -6.55840403272e-10, 5.24179002617e-9],
  [31, 10, 3.99161675027e-9, -4.73500202132e-9],
  [31, 11, 6.93506892777e-10, 2.08668068881e-8],
  [31, 12, 5.5287540984e-10, 4.52042167068e-9],
  [31, 13, 9.40389423562e-9, 4.6684078573e-9],
  [31, 14, -7.88650771167e-9, 3.51952460147e-9],
  [31, 15, 4.29954776132e-9, -2.80870684394e-9],
  [31, 16, -7.19430261173e-9, 6.11805049979e-9],
  [31, 17, -2.53821168958e-9, 6.83008216722e-9],
  [31, 18, -6.02099321996e-10, -2.04187286905e-9],
  [31, 19, 2.89086482301e-9, 4.43976791609e-9],
  [31, 20, -1.75732193914e-9, 5.64081954558e-9],
  [31, 21, -9.67143669208e-9, 7.09357408027e-9],
  [31, 22, -9.0531201252e-9, -1.18308417466e-8],
  [31, 23, 8.32234353898e-9, 4.51774572555e-9],
  [31, 24, -2.81565064366e-9, -3.34369513768e-9],
  [31, 25, -1.64574268169e-8, -2.20460908971e-9],
  [31, 26, -1.26653070356e-8, 1.59189398991e-9],
  [31, 27, -1.34953305827e-9, 1.07507650019e-8],
  [31, 28, 1.04226918411e-8, 2.8072229491e-9],
  [31, 29, -1.5812688103e-9, -2.18247510672e-9],
  [31, 30, -9.47416722001e-10, -7.78077525656e-9],
  [31, 31, -8.59193452715e-9, -1.85200316483e-9],
  [32, 0, -2.33966288032e-9, 0],
  [32, 1, -1.69210486076e-9, 1.27760467976e-9],
  [32, 2, 1.13999662663e-8, -3.35609127916e-9],
  [32, 3, -1.444433154e-10, 4.05424830941e-9],
  [32, 4, 8.56367829112e-10, -6.75422476107e-9],
  [32, 5, 8.60776205333e-9, 1.82572279646e-9],
  [32, 6, -1.00402568672e-8, -7.6305617634e-9],
  [32, 7, 1.37058613278e-9, 2.75465347035e-9],
  [32, 8, 1.19653531908e-8, 4.91018212548e-9],
  [32, 9, 7.332252213e-9, 7.18971591052e-10],
  [32, 10, 9.12133506379e-11, -5.70680927495e-9],
  [32, 11, -5.42043742127e-9, 7.583606425e-9],
  [32, 12, -1.70289059214e-8, 1.40808168623e-8],
  [32, 13, 4.02186822027e-9, 5.34936491964e-9],
  [32, 14, -5.44420334437e-9, 2.20410694316e-9],
  [32, 15, 5.1658020828e-9, -8.74727531741e-9],
  [32, 16, 4.14867061294e-9, 4.27270420004e-9],
  [32, 17, -6.46857778906e-9, 1.01916486215e-8],
  [32, 18, 1.27286345117e-8, -1.12136888089e-9],
  [32, 19, 7.55189536923e-10, -2.7754653073e-9],
  [32, 20, 3.8161056442e-9, 3.19534855653e-10],
  [32, 21, -2.33262996771e-9, 1.16411650251e-8],
  [32, 22, -1.20880678762e-8, -2.72691793232e-9],
  [32, 23, 8.18682122143e-9, -2.33549712722e-9],
  [32, 24, -3.55036315667e-9, 6.54834763861e-10],
  [32, 25, -1.89374992503e-8, -6.43429532848e-9],
  [32, 26, 5.22535531492e-9, -3.68856221241e-9],
  [32, 27, -4.53740085214e-9, -6.68075560111e-9],
  [32, 28, 1.653041745e-9, -5.73130340772e-9],
  [32, 29, 4.32768192965e-9, 2.88179889934e-9],
  [32, 30, -6.74805866294e-9, 1.39346268546e-9],
  [32, 31, -6.26740251766e-9, -2.18475608171e-10],
  [32, 32, 3.3975660331e-9, 1.42646165155e-9],
  [33, 0, -3.49357179498e-9, 0],
  [33, 1, -1.39642913445e-9, -2.16391760811e-9],
  [33, 2, -7.48774194896e-9, -5.0187208152e-10],
  [33, 3, -1.99661955793e-9, 7.0930410268e-9],
  [33, 4, -4.270199819e-9, 2.27426656698e-9],
  [33, 5, 2.37784729729e-10, 3.74439169451e-9],
  [33, 6, 1.22603039921e-9, -2.87328300836e-9],
  [33, 7, -6.11215086076e-9, 2.49383366316e-9],
  [33, 8, -8.23144405057e-10, 1.44915555407e-8],
  [33, 9, 5.05097392033e-9, 7.4051746902e-9],
  [33, 10, -2.39709923317e-9, 1.07022906758e-9],
  [33, 11, 2.43388836443e-9, -8.67071813487e-9],
  [33, 12, -2.33510532329e-9, 8.9435069891e-9],
  [33, 13, 2.6041538193e-9, 3.13805750981e-9],
  [33, 14, 4.92959662302e-9, 5.71204550617e-9],
  [33, 15, -4.64145303396e-9, -3.47835302325e-9],
  [33, 16, 7.39530517571e-9, 6.28613189283e-9],
  [33, 17, -5.73064590551e-9, 1.28779114927e-8],
  [33, 18, -9.74285933562e-9, -1.89598124592e-9],
  [33, 19, 8.52447331156e-9, 2.07561717246e-9],
  [33, 20, -3.32627500309e-9, -7.77689999053e-9],
  [33, 21, 9.38761672387e-10, 8.17787598674e-10],
  [33, 22, -1.05439940875e-8, -1.56190227392e-8],
  [33, 23, 1.15896250314e-10, -1.01356350767e-8],
  [33, 24, 1.11416074527e-8, -8.57153776484e-9],
  [33, 25, 5.24730532375e-9, -1.04941656537e-8],
  [33, 26, 1.09590005596e-8, 4.5404144025e-9],
  [33, 27, -1.32772908147e-9, 1.26154161942e-9],
  [33, 28, 1.75943381421e-9, -1.02060346415e-9],
  [33, 29, -1.63075128633e-8, 5.72191328891e-9],
  [33, 30, -1.56977064277e-9, -1.84579402264e-8],
  [33, 31, 4.69481868853e-9, 1.02290050028e-9],
  [33, 32, 6.56775919022e-9, -4.39711913398e-9],
  [33, 33, -1.52043850303e-9, 8.31263004529e-9],
  [34, 0, -9.08833340447e-9, 0],
  [34, 1, -2.76889795047e-9, 6.3891897021e-9],
  [34, 2, 6.7688190654e-9, 5.30082118696e-9],
  [34, 3, 1.25429669786e-8, 8.11619669834e-9],
  [34, 4, -8.30005417504e-9, 1.19586870272e-9],
  [34, 5, -3.88131685638e-9, 3.54963449977e-9],
  [34, 6, 4.84093709579e-10, 7.62975480293e-9],
  [34, 7, 2.75125793239e-9, -6.56263573163e-9],
  [34, 8, -9.83446807592e-9, 4.68751478021e-9],
  [34, 9, 1.53042494664e-9, 2.10165697829e-9],
  [34, 10, -7.52633242389e-9, 1.46544229781e-9],
  [34, 11, -3.82043431506e-9, -1.07829735599e-9],
  [34, 12, 1.42629362262e-8, -4.60063642968e-9],
  [34, 13, -3.56240984255e-9, 1.03329523096e-9],
  [34, 14, -2.50187664392e-9, 9.64686908241e-9],
  [34, 15, 3.75939804157e-10, 6.2628624977e-9],
  [34, 16, -1.45874042713e-9, -1.4938092908e-9],
  [34, 17, -4.73747570512e-9, 3.93698829389e-9],
  [34, 18, -1.47488701345e-8, -5.38197998817e-9],
  [34, 19, -3.59837568897e-9, 7.15302015583e-9],
  [34, 20, 3.64466859655e-9, -1.01824147346e-8],
  [34, 21, -9.81980297066e-10, -7.42166456548e-9],
  [34, 22, -3.18152215406e-9, 3.36620175035e-9],
  [34, 23, -1.1297312057e-9, -1.18981902172e-8],
  [34, 24, 8.78079044954e-9, 4.20436158037e-9],
  [34, 25, 8.41097170248e-9, -9.86300815266e-9],
  [34, 26, 3.99964384231e-9, -1.29360014691e-8],
  [34, 27, 1.31566196208e-8, -3.91137836409e-9],
  [34, 28, -1.65320604713e-10, -2.00370653858e-8],
  [34, 29, 7.08151676681e-9, -4.31563574113e-9],
  [34, 30, -2.05666035677e-8, -5.86948946952e-10],
  [34, 31, -4.57411268111e-9, -1.60852780125e-9],
  [34, 32, 9.14033593474e-9, 2.31645138264e-9],
  [34, 33, 1.37617937967e-8, 4.3547198646e-9],
  [34, 34, -8.54011998155e-9, 1.65364599023e-9],
  [35, 0, 8.60443158492e-9, 0],
  [35, 1, -1.07631176168e-8, -1.03576288219e-8],
  [35, 2, -1.48166749807e-8, 7.47316845223e-9],
  [35, 3, 1.88623900305e-9, 3.49967679465e-9],
  [35, 4, -2.82338523108e-9, 9.20674937921e-9],
  [35, 5, -7.23688443416e-9, -1.15478796146e-8],
  [35, 6, 3.28708320436e-9, 7.90142264483e-9],
  [35, 7, -3.45829826367e-9, 4.71386839716e-9],
  [35, 8, 4.15911228686e-9, 9.21486965423e-9],
  [35, 9, -7.83584593022e-10, -1.08780700595e-9],
  [35, 10, -2.63078124596e-9, 1.14437669825e-8],
  [35, 11, 3.1135284219e-9, -3.11508942142e-9],
  [35, 12, 8.10432165903e-9, -6.4323395678e-9],
  [35, 13, -1.60870380988e-9, 3.02852925442e-9],
  [35, 14, -7.16511186947e-9, -7.02737046917e-9],
  [35, 15, -1.53690564123e-8, 8.75984924717e-9],
  [35, 16, -6.89772047703e-9, -7.36827047584e-9],
  [35, 17, 7.03755899027e-10, -8.82920485773e-9],
  [35, 18, -5.55247661498e-9, -1.14710477959e-8],
  [35, 19, -1.07112499273e-9, -3.41854119412e-9],
  [35, 20, 9.92702305837e-10, -1.13573745208e-10],
  [35, 21, 1.29333785663e-8, -8.17657795386e-10],
  [35, 22, 7.51479477595e-9, 5.7229930908e-9],
  [35, 23, -8.16391242216e-9, -2.22442612532e-9],
  [35, 24, 2.78435090517e-9, 6.38499607176e-9],
  [35, 25, 7.16858934156e-9, 1.99781103645e-9],
  [35, 26, -4.70300232305e-9, 4.61488943108e-9],
  [35, 27, 1.09602089094e-8, -1.33812635796e-8],
  [35, 28, 7.88159460716e-9, -1.53673024839e-8],
  [35, 29, 7.70786810766e-9, 3.40140754669e-9],
  [35, 30, -4.0519283993e-9, 2.87370616224e-9],
  [35, 31, 7.84140204315e-9, 4.0412480788e-9],
  [35, 32, -3.16267901777e-9, -7.41858064221e-9],
  [35, 33, 5.8609633966e-9, -3.07739390905e-9],
  [35, 34, -1.21632099674e-9, 2.66717400938e-9],
  [35, 35, -5.8786572941e-9, -5.01230638002e-9],
  [36, 0, -4.02590604243e-9, 0],
  [36, 1, -1.13386686386e-9, 5.14982653283e-9],
  [36, 2, -4.31575901448e-9, -3.40211031655e-9],
  [36, 3, 7.00409280444e-11, -1.58895672921e-8],
  [36, 4, 3.00961129935e-9, 1.38917218538e-9],
  [36, 5, -7.42261535513e-9, 1.4033786019e-9],
  [36, 6, 1.08546024568e-8, -3.16311943226e-9],
  [36, 7, 1.70813806147e-9, 6.17680210154e-9],
  [36, 8, 3.44939360246e-9, -5.03767857861e-9],
  [36, 9, 2.92192219493e-9, -3.74028113708e-10],
  [36, 10, 4.23119681703e-9, 6.83503143788e-9],
  [36, 11, -4.10039232642e-9, 4.75118294475e-9],
  [36, 12, 4.87204962837e-10, -9.84587714675e-9],
  [36, 13, -6.15416963507e-9, 8.0318113556e-9],
  [36, 14, -1.04141682764e-8, -5.94203574762e-9],
  [36, 15, 9.54892409044e-10, 3.33310574172e-9],
  [36, 16, 1.25505913598e-9, -1.60569406116e-10],
  [36, 17, 4.95066186034e-9, -8.65314022477e-9],
  [36, 18, 1.77184202015e-9, 4.4603340077e-9],
  [36, 19, -5.25149217565e-9, -6.65319486115e-9],
  [36, 20, -6.03793346956e-9, 3.52627660597e-9],
  [36, 21, 1.0690892473e-8, -5.67948915026e-9],
  [36, 22, 3.21356130034e-9, 1.61234121461e-9],
  [36, 23, -3.61160199501e-10, 2.74891917069e-9],
  [36, 24, 2.10662869987e-9, -4.24514998756e-9],
  [36, 25, 4.3497929214e-9, 1.5607147346e-8],
  [36, 26, 3.68762567031e-9, 9.37175113714e-9],
  [36, 27, -7.91229464362e-9, 8.8299681063e-9],
  [36, 28, 2.22637976824e-9, -4.34372617405e-9],
  [36, 29, 1.84511675839e-9, 2.0734471834e-10],
  [36, 30, -1.00411515955e-8, 6.05413293608e-9],
  [36, 31, -8.39084442298e-9, -5.54047445598e-9],
  [36, 32, 1.25654207109e-8, 2.30476235625e-9],
  [36, 33, 3.89957606637e-9, -3.50340856893e-9],
  [36, 34, -9.08693282663e-9, 4.35776976715e-9],
  [36, 35, -1.38812503272e-10, -1.25527291076e-8],
  [36, 36, 4.6014646572e-9, -5.94245336314e-9],
];
