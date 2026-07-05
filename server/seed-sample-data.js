import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from './src/config/database.js';

async function generateSampleData() {
  console.log('[开始] 生成样例数据...\n');

  // ========== 1. 清理旧数据 ==========
  console.log('--- 清理旧数据 ---');
  // 先删员工（有外键依赖部门）
  await sequelize.query('DELETE FROM employees');
  // 删部门（保留 id=1 的根部门后面 UPDATE）
  await sequelize.query('DELETE FROM departments WHERE id > 1');
  // 重置自增（MySQL 8 支持）
  await sequelize.query('ALTER TABLE departments AUTO_INCREMENT = 2');
  await sequelize.query('ALTER TABLE employees AUTO_INCREMENT = 1');
  console.log('  已清理\n');

  // ========== 2. 部门树（逐层插入，按 code 查实际 ID） ==========
  console.log('--- 创建部门树 ---');

  // 辅助：按 code 查部门 ID
  const getDeptId = async (code) => {
    const [rows] = await sequelize.query('SELECT id FROM departments WHERE code = ?', { replacements: [code] });
    if (!rows.length) throw new Error(`部门 code=${code} 不存在`);
    return rows[0].id;
  };

  // Level 1: 更新根部门
  await sequelize.query(
    `UPDATE departments SET name=?, code=?, level=?, sort_order=?, description=?, is_active=?, updated_at=NOW() WHERE id=1`,
    { replacements: ['信阳移动公司工会', 'XY001', 1, 1, '总公司工会', 1] }
  );
  console.log('  L1: 信阳移动公司工会 (id=1, 更新)');

  // Level 2: 4 个二级部门
  const l2Depts = [
    { name: '综合管理部', code: 'XY002', sort: 1, desc: '负责行政、人事、财务等综合管理' },
    { name: '市场经营部', code: 'XY003', sort: 2, desc: '负责市场营销、客户服务' },
    { name: '网络运维部', code: 'XY004', sort: 3, desc: '负责网络建设与运维' },
    { name: '信息技术部', code: 'XY005', sort: 4, desc: '负责IT系统开发与维护' },
  ];
  for (const d of l2Depts) {
    await sequelize.query(
      `INSERT INTO departments (name, code, level, parent_id, sort_order, description, is_active, created_at, updated_at) VALUES (?, ?, 2, 1, ?, ?, 1, NOW(), NOW())`,
      { replacements: [d.name, d.code, d.sort, d.desc] }
    );
  }
  const rootId = 1;
  console.log(`  L2: ${l2Depts.length} 个部门 (parent_id=${rootId})`);

  // 查出 L2 实际 ID
  const id_综合 = await getDeptId('XY002');
  const id_市场 = await getDeptId('XY003');
  const id_网络 = await getDeptId('XY004');
  const id_信息 = await getDeptId('XY005');

  // Level 3
  const l3Depts = [
    { name: '人力资源部', code: 'XY006', parent: id_综合, sort: 1, desc: '招聘、培训、薪酬管理' },
    { name: '财务部', code: 'XY007', parent: id_综合, sort: 2, desc: '财务核算、预算管理' },
    { name: '行政办公室', code: 'XY008', parent: id_综合, sort: 3, desc: '日常行政事务' },
    { name: '客户服务部', code: 'XY009', parent: id_市场, sort: 1, desc: '客户投诉、业务咨询' },
    { name: '营销策划部', code: 'XY010', parent: id_市场, sort: 2, desc: '营销活动策划与执行' },
    { name: '渠道管理部', code: 'XY011', parent: id_市场, sort: 3, desc: '营业厅、代理商管理' },
    { name: '网络优化中心', code: 'XY012', parent: id_网络, sort: 1, desc: '网络质量优化' },
    { name: '基站维护组', code: 'XY013', parent: id_网络, sort: 2, desc: '基站设备维护' },
    { name: '传输维护组', code: 'XY014', parent: id_网络, sort: 3, desc: '传输线路维护' },
    { name: '软件开发组', code: 'XY015', parent: id_信息, sort: 1, desc: '内部系统开发' },
    { name: '系统运维组', code: 'XY016', parent: id_信息, sort: 2, desc: '服务器与系统运维' },
  ];
  for (const d of l3Depts) {
    await sequelize.query(
      `INSERT INTO departments (name, code, level, parent_id, sort_order, description, is_active, created_at, updated_at) VALUES (?, ?, 3, ?, ?, ?, 1, NOW(), NOW())`,
      { replacements: [d.name, d.code, d.parent, d.sort, d.desc] }
    );
  }
  console.log(`  L3: ${l3Depts.length} 个部门`);

  // 查出 L3 实际 ID（L4 需要）
  const id_人力 = await getDeptId('XY006');
  const id_软件 = await getDeptId('XY015');

  // Level 4
  const l4Depts = [
    { name: '招聘培训室', code: 'XY017', parent: id_人力, sort: 1, desc: '招聘与员工培训' },
    { name: '薪酬福利室', code: 'XY018', parent: id_人力, sort: 2, desc: '薪酬核算与福利管理' },
    { name: '前端开发室', code: 'XY019', parent: id_软件, sort: 1, desc: '前端技术开发' },
    { name: '后端开发室', code: 'XY020', parent: id_软件, sort: 2, desc: '后端技术开发' },
  ];
  for (const d of l4Depts) {
    await sequelize.query(
      `INSERT INTO departments (name, code, level, parent_id, sort_order, description, is_active, created_at, updated_at) VALUES (?, ?, 4, ?, ?, ?, 1, NOW(), NOW())`,
      { replacements: [d.name, d.code, d.parent, d.sort, d.desc] }
    );
  }
  console.log(`  L4: ${l4Depts.length} 个部门`);

  // 停用部门（测试 is_active=0）
  await sequelize.query(
    `INSERT INTO departments (name, code, level, parent_id, sort_order, description, is_active, created_at, updated_at) VALUES (?, ?, 2, 1, 99, ?, 0, NOW(), NOW())`,
    { replacements: ['已撤销部门', 'XY099', '已撤销的测试部门'] }
  );
  console.log('  停用部门: 1 个\n');

  // ========== 3. 员工数据 ==========
  console.log('--- 创建员工数据 ---');

  // 查出所有部门实际 ID
  const id_财务 = await getDeptId('XY007');
  const id_行政 = await getDeptId('XY008');
  const id_客服 = await getDeptId('XY009');
  const id_营销 = await getDeptId('XY010');
  const id_渠道 = await getDeptId('XY011');
  const id_网优 = await getDeptId('XY012');
  const id_基站 = await getDeptId('XY013');
  const id_传输 = await getDeptId('XY014');
  const id_系统 = await getDeptId('XY016');
  const id_招聘 = await getDeptId('XY017');
  const id_薪酬 = await getDeptId('XY018');
  const id_前端 = await getDeptId('XY019');
  const id_后端 = await getDeptId('XY020');

  const employees = [
    // 管理层 (management)
    { name: '张建国', gender: 'male', birthday: '1968-03-15', phone: '13800001001', dept: '综合管理部', deptCode: 'XY002', level: 'management', position: '总经理' },
    { name: '李秀英', gender: 'female', birthday: '1970-08-22', phone: '13800001002', dept: '市场经营部', deptCode: 'XY003', level: 'management', position: '副总经理' },
    { name: '王志强', gender: 'male', birthday: '1965-12-01', phone: '13800001003', dept: '网络运维部', deptCode: 'XY004', level: 'management', position: '副总经理' },

    // 经理 (manager)
    { name: '赵明华', gender: 'male', birthday: '1975-05-10', phone: '13800002001', dept: '人力资源部', deptCode: 'XY006', level: 'manager', position: '人力资源部经理' },
    { name: '陈雅琴', gender: 'female', birthday: '1978-11-20', phone: '13800002002', dept: '财务部', deptCode: 'XY007', level: 'manager', position: '财务部经理' },
    { name: '刘伟', gender: 'male', birthday: '1976-07-08', phone: '13800002003', dept: '客户服务部', deptCode: 'XY009', level: 'manager', position: '客服部经理' },
    { name: '孙丽', gender: 'female', birthday: '1980-02-14', phone: '13800002004', dept: '营销策划部', deptCode: 'XY010', level: 'manager', position: '营销策划部经理' },
    { name: '周强', gender: 'male', birthday: '1974-09-30', phone: '13800002005', dept: '网络优化中心', deptCode: 'XY012', level: 'manager', position: '网优中心主任' },
    { name: '吴芳', gender: 'female', birthday: '1979-04-18', phone: '13800002006', dept: '软件开发组', deptCode: 'XY015', level: 'manager', position: '开发组组长' },

    // 员工 (employee)
    { name: '郑小峰', gender: 'male', birthday: '1990-01-15', phone: '13800003001', dept: '招聘培训室', deptCode: 'XY017', level: 'employee', position: '招聘专员' },
    { name: '冯雪', gender: 'female', birthday: '1992-06-20', phone: '13800003002', dept: '薪酬福利室', deptCode: 'XY018', level: 'employee', position: '薪酬专员' },
    { name: '褚健', gender: 'male', birthday: '1988-03-08', phone: '13800003003', dept: '前端开发室', deptCode: 'XY019', level: 'employee', position: '前端开发工程师' },
    { name: '卫婷', gender: 'female', birthday: '1993-09-25', phone: '13800003004', dept: '后端开发室', deptCode: 'XY020', level: 'employee', position: '后端开发工程师' },
    { name: '蒋磊', gender: 'male', birthday: '1991-12-12', phone: '13800003005', dept: '系统运维组', deptCode: 'XY016', level: 'employee', position: '运维工程师' },
    { name: '沈佳', gender: 'female', birthday: '1994-04-05', phone: '13800003006', dept: '客户服务部', deptCode: 'XY009', level: 'employee', position: '客服专员' },
    { name: '韩涛', gender: 'male', birthday: '1989-07-18', phone: '13800003007', dept: '基站维护组', deptCode: 'XY013', level: 'employee', position: '基站维护员' },
    { name: '杨丽', gender: 'female', birthday: '1995-02-28', phone: '13800003008', dept: '渠道管理部', deptCode: 'XY011', level: 'employee', position: '渠道专员' },
    { name: '朱明', gender: 'male', birthday: '1987-10-10', phone: '13800003009', dept: '传输维护组', deptCode: 'XY014', level: 'employee', position: '传输维护员' },
    { name: '秦芳', gender: 'female', birthday: '1996-08-15', phone: '13800003010', dept: '行政办公室', deptCode: 'XY008', level: 'employee', position: '行政专员' },
    { name: '尤刚', gender: 'male', birthday: '1990-11-03', phone: '13800003011', dept: '营销策划部', deptCode: 'XY010', level: 'employee', position: '策划专员' },
    { name: '何静', gender: 'female', birthday: '1993-05-22', phone: '13800003012', dept: '网络优化中心', deptCode: 'XY012', level: 'employee', position: '网优工程师' },
    // 未分配部门（测试边界情况）
    { name: '吕文', gender: 'male', birthday: '1991-06-21', phone: '13800003013', dept: '', deptCode: null, level: 'employee', position: '实习生' },
    { name: '施敏', gender: 'female', birthday: '1995-06-11', phone: '13800003014', dept: '', deptCode: null, level: 'employee', position: '实习生' },
  ];

  // 构建 code→id 映射
  const codeToId = {
    'XY002': id_综合, 'XY003': id_市场, 'XY004': id_网络, 'XY005': id_信息,
    'XY006': id_人力, 'XY007': id_财务, 'XY008': id_行政,
    'XY009': id_客服, 'XY010': id_营销, 'XY011': id_渠道,
    'XY012': id_网优, 'XY013': id_基站, 'XY014': id_传输,
    'XY015': id_软件, 'XY016': id_系统,
    'XY017': id_招聘, 'XY018': id_薪酬, 'XY019': id_前端, 'XY020': id_后端,
  };

  for (const emp of employees) {
    const deptId = emp.deptCode ? codeToId[emp.deptCode] : null;
    await sequelize.query(
      `INSERT INTO employees (name, gender, birthday, phone, department, department_id, department_code, level, position, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      { replacements: [emp.name, emp.gender, emp.birthday, emp.phone, emp.dept, deptId, emp.deptCode, emp.level, emp.position] }
    );
  }
  console.log(`  已创建 ${employees.length} 名员工\n`);

  // ========== 4. 统计 ==========
  const [deptCount] = await sequelize.query('SELECT COUNT(*) as cnt FROM departments');
  const [empCount] = await sequelize.query('SELECT COUNT(*) as cnt FROM employees');
  const [levelStats] = await sequelize.query("SELECT level, COUNT(*) as cnt FROM employees GROUP BY level");
  const [deptTree] = await sequelize.query("SELECT id, name, code, level, parent_id FROM departments WHERE is_active=1 ORDER BY level, sort_order");

  console.log('--- 数据统计 ---');
  console.log(`  部门总数: ${deptCount[0].cnt}`);
  console.log(`  员工总数: ${empCount[0].cnt}`);
  console.log(`  职级分布:`);
  for (const row of levelStats) {
    console.log(`    ${row.level}: ${row.cnt} 人`);
  }
  console.log('\n--- 部门树结构 ---');
  for (const d of deptTree) {
    const indent = '  '.repeat(d.level);
    console.log(`${indent}[${d.id}] ${d.name} (${d.code})`);
  }
  console.log('\n[完成] 样例数据生成完毕！');

  process.exit(0);
}

generateSampleData().catch(err => {
  console.error('[错误]', err.message);
  process.exit(1);
});
